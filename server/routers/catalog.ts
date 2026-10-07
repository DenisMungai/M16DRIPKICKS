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

  const result = await db.query<ProductRow>(
    `${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${SORTS[input.sort]}`,
    args,
  );
  let items = result.rows.map(productDto);
  if (input.size) items = items.filter((p) => p.sizes.includes(input.size!));
  return { items: items.slice(0, input.limit), total: items.length };
}

type CategoryRow = { id: number; name: string; slug: string; count: number };
type BrandRow = { id: number; name: string; blurb: string; cta: string; count: number };

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

  categories: publicProcedure.query(async () => {
    const [categories, products] = await Promise.all([
      db.query<Omit<CategoryRow, 'count'>>('SELECT id, name, slug FROM categories ORDER BY id'),
      db.query<{ category_id: number }>('SELECT category_id FROM products WHERE active = 1'),
    ]);
    const counts = new Map<number, number>();
    for (const product of products.rows) counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    return categories.rows.map((category) => ({ ...category, count: counts.get(category.id) ?? 0 }));
  }),

  brands: publicProcedure.query(async () => {
    const result = await db.query<BrandRow>(`
      SELECT b.id, b.name, b.blurb, b.cta, COUNT(p.id)::integer AS count
      FROM brands b LEFT JOIN products p ON p.brand_id = b.id AND p.active = 1
      GROUP BY b.id ORDER BY b.name`);
    return Promise.all(result.rows.filter((brand) => brand.count > 0).map(async (brand) => ({
      ...brand,
      top: (await db.query<ProductRow>(
        `${PRODUCT_SELECT} WHERE p.active = 1 AND p.brand_id = $1 ORDER BY p.sold DESC LIMIT 3`,
        [brand.id],
      )).rows.map(productDto),
    })));
  }),

  home: publicProcedure.query(async () => {
    const [newArrivals, bestSellers, deals] = await Promise.all([
      listProducts({ isNew: true, sort: 'newest', limit: 4 }),
      listProducts({ sort: 'featured', limit: 4 }),
      listProducts({ onSale: true, sort: 'discount', limit: 4 }),
    ]);
    return { newArrivals: newArrivals.items, bestSellers: bestSellers.items, deals: deals.items };
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
