import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { fromKes, orderDto, PRODUCT_SELECT, productDto, toKes, type OrderRow, type ProductRow } from '../models.js';
import { setOrderStatus } from '../services/orders.js';
import { cancelOrder } from '../services/settlement.js';
import { adminProcedure, router } from '../trpc.js';

const REVENUE = `payment_status = 'paid' AND status != 'cancelled'`;
const REAL_ORDERS = `(payment_ref IS NULL OR payment_ref NOT LIKE 'SEED-%')`;
const DAY = 86_400_000;
const pctChange = (cur: number, prev: number) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);
const monthStart = (offset = 0) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString();
};

async function dashboard(range: 'week' | 'month' | 'year') {
  const sum = async (where: string, values: unknown[] = []) => {
    const result = await db.query<{ s: number; n: number }>(
      `SELECT COALESCE(SUM(total_cents),0)::integer AS s, COUNT(*)::integer AS n FROM orders WHERE ${where}`,
      values,
    );
    return result.rows[0];
  };
  const [total, thisM, lastM, ordersAllResult, ordersThisResult, ordersLastResult, custAllResult, custThisResult, custLastResult] = await Promise.all([
    sum(`${REAL_ORDERS} AND ${REVENUE}`),
    sum(`${REAL_ORDERS} AND ${REVENUE} AND created_at >= $1`, [monthStart(0)]),
    sum(`${REAL_ORDERS} AND ${REVENUE} AND created_at >= $1 AND created_at < $2`, [monthStart(-1), monthStart(0)]),
    db.query<{ n: number }>(`SELECT COUNT(*)::integer AS n FROM orders WHERE ${REAL_ORDERS} AND status != 'cancelled'`),
    db.query<{ n: number }>(`SELECT COUNT(*)::integer AS n FROM orders WHERE ${REAL_ORDERS} AND status != 'cancelled' AND created_at >= $1`, [monthStart(0)]),
    db.query<{ n: number }>(`SELECT COUNT(*)::integer AS n FROM orders WHERE ${REAL_ORDERS} AND status != 'cancelled' AND created_at >= $1 AND created_at < $2`, [monthStart(-1), monthStart(0)]),
    db.query<{ n: number }>(`SELECT COUNT(DISTINCT user_id)::integer AS n FROM orders WHERE ${REAL_ORDERS}`),
    db.query<{ n: number }>(`SELECT COUNT(DISTINCT user_id)::integer AS n FROM orders WHERE ${REAL_ORDERS} AND created_at >= $1`, [monthStart(0)]),
    db.query<{ n: number }>(`SELECT COUNT(DISTINCT user_id)::integer AS n FROM orders WHERE ${REAL_ORDERS} AND created_at >= $1 AND created_at < $2`, [monthStart(-1), monthStart(0)]),
  ]);

  const ordersAll = ordersAllResult.rows[0].n;
  const ordersThis = ordersThisResult.rows[0].n;
  const ordersLast = ordersLastResult.rows[0].n;
  const custAll = custAllResult.rows[0].n;
  const custThis = custThisResult.rows[0].n;
  const custLast = custLastResult.rows[0].n;
  const now = new Date();
  const chartRows = await db.query<{ created_at: string; total_cents: number }>(
    `SELECT created_at, total_cents FROM orders WHERE ${REAL_ORDERS} AND ${REVENUE} AND created_at >= $1`,
    [new Date(now.getTime() - 366 * DAY).toISOString()],
  );
  const rows = chartRows.rows;
  let labels: string[];
  let values: number[];
  if (range === 'week') {
    const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (6 - i))));
    labels = days.map((d) => d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }));
    values = days.map((d) => rows.filter((r) => r.created_at.slice(0, 10) === d.toISOString().slice(0, 10)).reduce((s, r) => s + r.total_cents, 0));
  } else if (range === 'month') {
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    labels = ['W1', 'W2', 'W3', 'W4'];
    values = labels.map((_, i) => {
      const from = end - (4 - i) * 7 * DAY;
      const to = from + 7 * DAY;
      return rows.filter((r) => { const t = Date.parse(r.created_at); return t >= from && t < to; }).reduce((s, r) => s + r.total_cents, 0);
    });
  } else {
    const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1)));
    labels = months.map((d) => d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }));
    values = months.map((d) => rows.filter((r) => r.created_at.slice(0, 7) === d.toISOString().slice(0, 7)).reduce((s, r) => s + r.total_cents, 0));
  }

  const units = async (from: string, to: string) => {
    const result = await db.query<{ name: string; units: number }>(`
      SELECT c.name, SUM(oi.qty)::integer AS units FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id JOIN categories c ON c.id = p.category_id
      WHERE (o.payment_ref IS NULL OR o.payment_ref NOT LIKE 'SEED-%')
        AND o.status != 'cancelled' AND o.created_at >= $1 AND o.created_at < $2
      GROUP BY c.name`, [from, to]);
    return result.rows;
  };
  const [cur, prevRows, recentResult] = await Promise.all([
    units(new Date(now.getTime() - 30 * DAY).toISOString(), new Date(now.getTime() + DAY).toISOString()),
    units(new Date(now.getTime() - 60 * DAY).toISOString(), new Date(now.getTime() - 30 * DAY).toISOString()),
    db.query<{ code: string; created_at: string; total_cents: number; status: string; customer: string; first_item: string; n_items: number }>(`
      SELECT o.code, o.created_at, o.total_cents, o.status, u.name AS customer,
        MIN(oi.name) AS first_item, COUNT(oi.id)::integer AS n_items
      FROM orders o JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE ${REAL_ORDERS}
      GROUP BY o.id,u.name ORDER BY o.created_at DESC LIMIT 8`),
  ]);
  const prev = new Map(prevRows.map((row) => [row.name, row.units]));
  const trending = cur.sort((a, b) => b.units - a.units).slice(0, 3)
    .map((row) => ({ name: row.name, units: row.units, delta: pctChange(row.units, prev.get(row.name) ?? 0) }));
  const recent = recentResult.rows.map((row) => ({
    code: row.code, createdAt: row.created_at, total: toKes(row.total_cents), status: row.status, customer: row.customer,
    product: row.n_items > 1 ? `${row.first_item} +${row.n_items - 1} more` : row.first_item,
  }));

  return {
    cards: {
      revenue: { value: toKes(total.s), delta: pctChange(thisM.s, lastM.s) },
      orders: { value: ordersAll, delta: pctChange(ordersThis, ordersLast) },
      customers: { value: custAll, delta: pctChange(custThis, custLast) },
    },
    chart: { labels, values: values.map(toKes), total: toKes(values.reduce((a, b) => a + b, 0)) },
    trending, recent,
  };
}

const productInput = z.object({
  sku: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  sub: z.string().trim().max(120).default(''),
  description: z.string().trim().max(2000).default(''),
  category: z.string().trim().min(2).max(60),
  brand: z.string().trim().max(60).nullish(),
  price: z.number().min(0).max(100000),
  was: z.number().min(0).max(100000).nullish(),
  badge: z.string().trim().max(30).nullish(),
  isNew: z.boolean().default(false),
  stock: z.number().int().min(0).max(100000),
  image: z.string().trim().max(500).nullish().refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith('/'), 'Use a full image URL.'),
  sizes: z.array(z.string().trim().min(1).max(10)).max(20).default([]),
  colors: z.array(z.object({ name: z.string().trim().min(1).max(30), swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(10).default([]),
  active: z.boolean().default(true),
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function upsertRefs(input: z.infer<typeof productInput>) {
  return db.transaction(async (client) => {
    const cat = await client.query<{ id: number }>(
      'INSERT INTO categories (name, slug) VALUES ($1,$2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [input.category, slug(input.category)],
    );
    let brandId: number | null = null;
    if (input.brand) {
      const brand = await client.query<{ id: number }>(
        'INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [input.brand],
      );
      brandId = brand.rows[0].id;
    }
    return { categoryId: cat.rows[0].id, brandId };
  });
}

function assertPrices(input: z.infer<typeof productInput>) {
  if (input.was && input.was <= input.price) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'The original price must be higher than the sale price.' });
  }
}

type CouponAdminRow = {
  id: number; code: string; tag: string; title: string; note: string;
  type: 'percent' | 'fixed' | 'freeship'; value: number; min_spend_cents: number;
  expires_at: string | null; one_per_user: number; auto_grant: number; active: number;
};

const couponDto = (coupon: CouponAdminRow) => ({
  id: coupon.id,
  code: coupon.code,
  tag: coupon.tag,
  title: coupon.title,
  note: coupon.note,
  type: coupon.type,
  value: coupon.type === 'fixed' ? toKes(coupon.value) : coupon.value,
  minSpend: toKes(coupon.min_spend_cents),
  expiresAt: coupon.expires_at,
  onePerUser: !!coupon.one_per_user,
  autoGrant: !!coupon.auto_grant,
  active: !!coupon.active,
});

const couponInput = z.object({
  code: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_-]+$/, 'Use only letters, numbers, hyphens, and underscores.'),
  tag: z.string().trim().min(1).max(30).default('Offer'),
  title: z.string().trim().min(2).max(120),
  note: z.string().trim().max(300).default(''),
  type: z.enum(['percent', 'fixed', 'freeship']),
  value: z.number().int().min(0).max(100000),
  minSpend: z.number().int().min(0).max(1000000).default(0),
  expiresAt: z.string().datetime().nullish(),
  onePerUser: z.boolean().default(false),
  autoGrant: z.boolean().default(false),
  active: z.boolean().default(true),
}).superRefine((coupon, ctx) => {
  if (coupon.type === 'percent' && (coupon.value < 1 || coupon.value > 100)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Percentage must be between 1 and 100.' });
  }
  if (coupon.type === 'fixed' && coupon.value < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Enter a fixed discount greater than zero.' });
  }
  if (coupon.type === 'freeship' && coupon.value !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Free-shipping coupons do not use a discount amount.' });
  }
});

export const adminRouter = router({
  dashboard: adminProcedure.input(z.object({ range: z.enum(['week', 'month', 'year']).default('week') })).query(({ input }) => dashboard(input.range)),

  coupons: adminProcedure.query(async () => {
    const result = await db.query<CouponAdminRow>('SELECT * FROM coupons ORDER BY id DESC');
    return result.rows.map(couponDto);
  }),

  couponCreate: adminProcedure.input(couponInput).mutation(async ({ input }) => {
    return db.transaction(async (client) => {
      const duplicate = await client.query('SELECT 1 FROM coupons WHERE code = $1', [input.code]);
      if (duplicate.rowCount) throw new TRPCError({ code: 'CONFLICT', message: 'That coupon code is already in use.' });
      const result = await client.query<CouponAdminRow>(`
        INSERT INTO coupons (code,tag,title,note,type,value,min_spend_cents,expires_at,one_per_user,auto_grant,active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *`, [
        input.code, input.tag, input.title, input.note, input.type,
        input.type === 'fixed' ? fromKes(input.value) : input.value,
        fromKes(input.minSpend), input.expiresAt ?? null, input.onePerUser ? 1 : 0,
        input.autoGrant ? 1 : 0, input.active ? 1 : 0,
      ]);
      const coupon = result.rows[0];
      if (input.autoGrant) {
        await client.query(
          `INSERT INTO user_coupons (user_id,coupon_id)
           SELECT id,$1::integer FROM users WHERE role = 'customer'
           ON CONFLICT DO NOTHING`,
          [coupon.id],
        );
      }
      return couponDto(coupon);
    });
  }),

  couponSetActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const result = await db.query<CouponAdminRow>(
        'UPDATE coupons SET active = $1 WHERE id = $2 RETURNING *',
        [input.active ? 1 : 0, input.id],
      );
      const coupon = result.rows[0];
      if (!coupon) throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon not found.' });
      return couponDto(coupon);
    }),

  inventory: adminProcedure
    .input(z.object({
      q: z.string().trim().max(80).optional(),
      category: z.string().optional(),
      status: z.enum(['in', 'low', 'out']).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(10),
    }))
    .query(async ({ input }) => {
      const where = ['p.active = 1'];
      const args: (string | number)[] = [];
      const param = (value: string | number) => { args.push(value); return `$${args.length}`; };
      if (input.q) { const term = param(`%${input.q}%`); where.push(`(p.name ILIKE ${term} OR p.sku ILIKE ${term})`); }
      if (input.category) where.push(`c.name = ${param(input.category)}`);
      if (input.status === 'out') where.push('p.stock = 0');
      if (input.status === 'low') where.push(`p.stock > 0 AND p.stock < ${param(config.lowStockThreshold)}`);
      if (input.status === 'in') where.push(`p.stock >= ${param(config.lowStockThreshold)}`);
      const base = `${PRODUCT_SELECT} WHERE ${where.join(' AND ')}`;
      const [countResult, rows] = await Promise.all([
        db.query<{ n: number }>(`SELECT COUNT(*)::integer AS n FROM (${base}) inventory`, args),
        db.query<ProductRow>(`${base} ORDER BY p.id DESC LIMIT ${param(input.pageSize)} OFFSET ${param((input.page - 1) * input.pageSize)}`, args),
      ]);
      const total = countResult.rows[0].n;
      return {
        items: rows.rows.map(productDto), total, page: input.page,
        pages: Math.max(1, Math.ceil(total / input.pageSize)), lowThreshold: config.lowStockThreshold,
      };
    }),

  productCreate: adminProcedure.input(productInput).mutation(async ({ input }) => {
    assertPrices(input);
    const duplicate = await db.query('SELECT 1 FROM products WHERE sku = $1', [input.sku]);
    if (duplicate.rowCount) throw new TRPCError({ code: 'CONFLICT', message: 'That SKU is already in use.' });
    const { categoryId, brandId } = await upsertRefs(input);
    const result = await db.query<{ id: number }>(`INSERT INTO products
      (sku,name,sub,description,category_id,brand_id,price_cents,was_cents,badge,is_new,stock,image,sizes,colors,active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`, [
      input.sku, input.name, input.sub, input.description, categoryId, brandId, fromKes(input.price),
      input.was ? fromKes(input.was) : null, input.badge || null, input.isNew ? 1 : 0, input.stock, input.image || null,
      JSON.stringify(input.sizes), JSON.stringify(input.colors), input.active ? 1 : 0,
    ]);
    return { id: result.rows[0].id };
  }),

  productUpdate: adminProcedure.input(productInput.extend({ id: z.number().int() })).mutation(async ({ input }) => {
    assertPrices(input);
    const duplicate = await db.query('SELECT 1 FROM products WHERE sku = $1 AND id != $2', [input.sku, input.id]);
    if (duplicate.rowCount) throw new TRPCError({ code: 'CONFLICT', message: 'That SKU is already in use.' });
    const { categoryId, brandId } = await upsertRefs(input);
    const result = await db.query(`UPDATE products SET sku=$1,name=$2,sub=$3,description=$4,category_id=$5,brand_id=$6,price_cents=$7,
      was_cents=$8,badge=$9,is_new=$10,stock=$11,image=$12,sizes=$13,colors=$14,active=$15 WHERE id=$16 RETURNING id`, [
      input.sku, input.name, input.sub, input.description, categoryId, brandId, fromKes(input.price),
      input.was ? fromKes(input.was) : null, input.badge || null, input.isNew ? 1 : 0, input.stock, input.image || null,
      JSON.stringify(input.sizes), JSON.stringify(input.colors), input.active ? 1 : 0, input.id,
    ]);
    if (!result.rowCount) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found.' });
    return { id: input.id };
  }),

  productDelete: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    await db.transaction(async (client) => {
      await client.query('UPDATE products SET active = 0 WHERE id = $1', [input.id]);
      await client.query('DELETE FROM wishlist WHERE product_id = $1', [input.id]);
    });
    return { ok: true };
  }),

  orders: adminProcedure
    .input(z.object({
      status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(10),
    }))
    .query(async ({ input }) => {
      const where = input.status
        ? `WHERE o.status = $1 AND ${REAL_ORDERS}`
        : `WHERE ${REAL_ORDERS}`;
      const args: (string | number)[] = input.status ? [input.status] : [];
      const offset = args.length;
      args.push(input.pageSize, (input.page - 1) * input.pageSize);
      const [totalResult, rows] = await Promise.all([
        db.query<{ n: number }>(`SELECT COUNT(*)::integer AS n FROM orders o ${where}`, input.status ? [input.status] : []),
        db.query<OrderRow>(`SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT $${offset + 1} OFFSET $${offset + 2}`, args),
      ]);
      const total = totalResult.rows[0].n;
      return { items: await Promise.all(rows.rows.map(orderDto)), total, page: input.page, pages: Math.max(1, Math.ceil(total / input.pageSize)) };
    }),

  orderUpdate: adminProcedure
    .input(z.object({
      code: z.string(),
      status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
      tracking: z.string().trim().max(60).nullish(),
    }))
    .mutation(async ({ input }) => {
      if (input.status === 'cancelled') {
        if (!await cancelOrder(input.code, 'Cancelled by store.')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Shipped or delivered orders cannot be cancelled.' });
        }
      } else {
        await setOrderStatus(input.code, input.status, input.tracking);
      }
      return { ok: true };
    }),
});
