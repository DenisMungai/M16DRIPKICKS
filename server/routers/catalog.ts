import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { PRODUCT_SELECT, productDto, type ProductRow } from '../models.js';
import { publicProcedure, router } from '../trpc.js';
import { buildQuote } from '../services/pricing.js';
import { stripeEnabled } from '../services/payments.js';

const SORTS = {
  featured: 'p.sold DESC, p.id DESC',
  popular: 'p.review_count DESC, p.sold DESC',
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price_cents ASC',
  price_desc: 'p.price_cents DESC',
  discount: '(CASE WHEN p.was_cents IS NULL THEN 0 ELSE (p.was_cents - p.price_cents) * 1.0 / p.was_cents END) DESC',
} as const;

export const listInput = z.object({
  category: z.string().optional(),
  categories: z.array(z.string()).max(20).optional(),
  brand: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  onSale: z.boolean().optional(),
  isNew: z.boolean().optional(),
  minDiscount: z.number().min(0).max(100).optional(),
  maxDiscount: z.number().min(0).max(100).optional(),
  size: z.string().optional(),
  sort: z.enum(['featured', 'popular', 'newest', 'price_asc', 'price_desc', 'discount']).default('featured'),
  limit: z.number().int().min(1).max(100).default(24),
});

export async function listProducts(input: z.infer<typeof listInput>) {
  const where: string[] = ['p.active = 1'];
  const args: (string | number | string[])[] = [];
  const param = (value: string | number | string[]) => {
    args.push(value);
    return `$${args.length}`;
  };
  if (input.category) where.push(`c.slug = ${param(input.category)}`);
  if (input.categories?.length) where.push(`c.slug = ANY(${param(input.categories)}::text[])`);
  if (input.brand) where.push(`b.name = ${param(input.brand)}`);
  if (input.onSale) where.push('p.was_cents IS NOT NULL AND p.was_cents > p.price_cents');
  if (input.isNew) where.push('p.is_new = 1');
  if (input.q) {
    const like = `%${input.q.replace(/[%_]/g, '')}%`;
    const term = param(like);
    where.push(`(p.name ILIKE ${term} OR p.sub ILIKE ${term} OR c.name ILIKE ${term} OR b.name ILIKE ${term})`);
  }
  const pct = '((p.was_cents - p.price_cents) * 100.0 / p.was_cents)';
  if (input.minDiscount !== undefined) where.push(`p.was_cents IS NOT NULL AND ${pct} >= ${param(input.minDiscount)}`);
  if (input.maxDiscount !== undefined) where.push(`p.was_cents IS NOT NULL AND ${pct} < ${param(input.maxDiscount)}`);

  // Fix 4: Apply SQL LIMIT to avoid fetching the entire table.
  // When a size filter is active we need all matching rows in memory to filter,
  // so we cap at a safe maximum (500) instead of an unbounded scan.
  const hasMemoryFilter = !!input.size;
  const sqlLimit = hasMemoryFilter ? Math.min(input.limit * 20, 500) : input.limit;
  args.push(sqlLimit);

  const result = await db.query<ProductRow>(
    `${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${SORTS[input.sort]} LIMIT $${args.length}`,
    args,
  );
  let items = result.rows.map(productDto);
  if (input.size) items = items.filter((p) => p.sizes.includes(input.size!));
  return { items: items.slice(0, input.limit), total: items.length };
}

type CategoryRow = { id: number; name: string; slug: string; count: number };
type BrandRow = { id: number; name: string; blurb: string; cta: string; count: number };

// Fix 3 (categories): Single SQL query with COUNT instead of two queries + JS join
async function listCategories(): Promise<CategoryRow[]> {
  const result = await db.query<CategoryRow>(`
    SELECT c.id, c.name, c.slug, COUNT(p.id)::integer AS count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
    GROUP BY c.id, c.name, c.slug
    ORDER BY c.id
  `);
  return result.rows;
}

export const catalogRouter = router({
  products: router({
    list: publicProcedure.input(listInput).query(({ input }) => listProducts(input)),

    byId: publicProcedure.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
      const result = await db.query<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = $1 AND p.active = 1`, [input.id]);
      const row = result.rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'This product could not be found.' });
      return productDto(row);
    }),

    related: publicProcedure.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
      const base = await db.query<{ category_id: number }>('SELECT category_id FROM products WHERE id = $1', [input.id]);
      const categoryId = base.rows[0]?.category_id;
      if (!categoryId) return [];
      const rows = await db.query<ProductRow>(
        `${PRODUCT_SELECT} WHERE p.active = 1 AND p.id != $1 ORDER BY (p.category_id = $2) DESC, p.sold DESC LIMIT 8`,
        [input.id, categoryId],
      );
      return rows.rows.map(productDto);
    }),
  }),

  // Fix 3: categories uses a single SQL query (was two queries + JS join)
  categories: publicProcedure.query(() => listCategories()),

  // Fix 5: brands — replace N+1 with 2 queries total (one for brands+counts,
  // one for all brand top-products at once, grouped in JS)
  brands: publicProcedure.query(async () => {
    const brandsResult = await db.query<BrandRow>(`
      SELECT b.id, b.name, b.blurb, b.cta, COUNT(p.id)::integer AS count
      FROM brands b
      LEFT JOIN products p ON p.brand_id = b.id AND p.active = 1
      GROUP BY b.id, b.name, b.blurb, b.cta
      ORDER BY b.name
    `);
    const activeBrands = brandsResult.rows.filter((b) => b.count > 0);
    if (!activeBrands.length) return [];

    const brandIds = activeBrands.map((b) => b.id);

    // Fetch top-3 products for ALL brands in a single query using ROW_NUMBER()
    const topResult = await db.query<ProductRow & { rn: number }>(`
      SELECT sub.*, sub.rn FROM (
        SELECT ${PRODUCT_SELECT.replace(/^\s*SELECT\s+/i, '')},
               ROW_NUMBER() OVER (PARTITION BY p.brand_id ORDER BY p.sold DESC, p.id DESC) AS rn
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE p.active = 1 AND p.brand_id = ANY($1::int[])
      ) sub WHERE sub.rn <= 3
    `, [brandIds]);

    // Group top products by brand_id
    const topByBrand = new Map<number, ProductRow[]>();
    for (const row of topResult.rows) {
      const arr = topByBrand.get(row.brand_id!) ?? [];
      arr.push(row);
      topByBrand.set(row.brand_id!, arr);
    }

    return activeBrands.map((brand) => ({
      ...brand,
      top: (topByBrand.get(brand.id) ?? []).map(productDto),
    }));
  }),

  // Fix 3: home now includes categories so the frontend only needs ONE round trip
  home: publicProcedure.query(async () => {
    const [newArrivals, bestSellers, deals, categories] = await Promise.all([
      listProducts({ isNew: true, sort: 'newest', limit: 4 }),
      listProducts({ sort: 'featured', limit: 4 }),
      listProducts({ onSale: true, sort: 'discount', limit: 4 }),
      listCategories(),
    ]);
    return {
      newArrivals: newArrivals.items,
      bestSellers: bestSellers.items,
      deals: deals.items,
      categories,
    };
  }),
});

export const checkoutRouter = router({
  quote: publicProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.number().int(), qty: z.number().int().min(1).max(10),
        size: z.string().nullish(), color: z.string().nullish(),
      })).max(50),
      couponCode: z.string().max(40).nullish(),
      shippingMethod: z.enum(['standard', 'express']).default('standard'),
    }))
    .query(async ({ input, ctx }) => {
      const q = await buildQuote({ ...input, userId: ctx.user?.id });
      return {
        ...q,
        lines: q.lines.map((l) => {
          if (l.unavailable) return l;
          const { priceCents: _p, sku: _s, ...pub } = l;
          return pub;
        }),
      };
    }),
});

export const metaRouter = router({
  config: publicProcedure.query(() => ({
    kesPerUsd: config.kesPerUsd,
    shippingStandard: Math.round((config.shippingCents.standard / 100) * config.kesPerUsd),
    shippingExpress: Math.round((config.shippingCents.express / 100) * config.kesPerUsd),
    cardLive: stripeEnabled(),
    mpesaLive: config.mpesa.live,
  })),
});
