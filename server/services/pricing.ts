import { config } from '../config.js';
import { db } from '../db.js';
import { getProductRows, productDto, toKes, type ProductRow } from '../models.js';
import type { PoolClient } from 'pg';

export type ShippingMethod = 'standard' | 'express';
export type LineInput = { productId: number; qty: number; size?: string | null; color?: string | null };

type CouponRow = {
  id: number; code: string; tag: string; title: string; note: string; type: 'percent' | 'fixed' | 'freeship';
  value: number; min_spend_cents: number; expires_at: string | null; one_per_user: number; auto_grant: number; active: number;
};

export type CouponResult =
  | { ok: true; coupon: CouponRow; discountCents: number; freeShipping: boolean }
  | { ok: false; message: string };

export async function findCoupon(code: string, client?: PoolClient) {
  const result = client
    ? await client.query<CouponRow>('SELECT * FROM coupons WHERE code = $1', [code.trim().toUpperCase()])
    : await db.query<CouponRow>('SELECT * FROM coupons WHERE code = $1', [code.trim().toUpperCase()]);
  return result.rows[0];
}

export async function evaluateCoupon(code: string, subtotalCents: number, userId?: number | null, client?: PoolClient): Promise<CouponResult> {
  const coupon = await findCoupon(code, client);
  if (!coupon || !coupon.active) return { ok: false, message: 'That code is not valid.' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { ok: false, message: 'That code has expired.' };
  }
  if (subtotalCents < coupon.min_spend_cents) {
    return { ok: false, message: `Spend at least KSh ${toKes(coupon.min_spend_cents).toLocaleString('en-KE')} to use ${coupon.code}.` };
  }
  if (coupon.one_per_user && userId) {
    const used = client
      ? await client.query(`SELECT 1 FROM orders WHERE user_id = $1 AND coupon_code = $2 AND status != 'cancelled' LIMIT 1`, [userId, coupon.code])
      : await db.query(`SELECT 1 FROM orders WHERE user_id = $1 AND coupon_code = $2 AND status != 'cancelled' LIMIT 1`, [userId, coupon.code]);
    if (used.rowCount) return { ok: false, message: `You have already used ${coupon.code}.` };
  }
  let discountCents = 0;
  if (coupon.type === 'percent') discountCents = Math.round((subtotalCents * coupon.value) / 100);
  if (coupon.type === 'fixed') discountCents = Math.min(coupon.value, subtotalCents);
  return { ok: true, coupon, discountCents, freeShipping: coupon.type === 'freeship' };
}

export type QuoteInput = {
  items: LineInput[];
  couponCode?: string | null;
  shippingMethod: ShippingMethod;
  userId?: number | null;
};

export async function buildQuote(input: QuoteInput, client?: PoolClient) {
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const rows = new Map<number, ProductRow>((await getProductRows(ids, client)).map((r) => [r.id, r]));
  const issues: string[] = [];

  // Stock is checked per product across every line (same shoe in two sizes shares one stock pool).
  const wanted = new Map<number, number>();
  for (const it of input.items) wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + clampQty(it.qty));

  const lines = input.items.map((it) => {
    const key = `${it.productId}|${it.size ?? ''}|${it.color ?? ''}`;
    const row = rows.get(it.productId);
    if (!row || !row.active) {
      issues.push('An item in your cart is no longer available.');
      return { key, productId: it.productId, unavailable: true as const };
    }
    const qty = clampQty(it.qty);
    const product = productDto(row);
    if (product.sizes.length && (!it.size || !product.sizes.includes(it.size))) {
      issues.push(`Select a size for ${product.name}.`);
    }
    const total = wanted.get(row.id) ?? qty;
    if (row.stock === 0) issues.push(`${product.name} is sold out.`);
    else if (row.stock < total) issues.push(`Only ${row.stock} of ${product.name} left.`);
    return {
      key, productId: row.id, unavailable: false as const, name: product.name, sub: product.sub,
      image: product.image, category: product.category, sizes: product.sizes,
      size: it.size ?? null, color: it.color ?? null, qty, stock: row.stock,
      unitPrice: product.price, lineTotal: toKes(row.price_cents * qty),
      priceCents: row.price_cents, sku: row.sku,
    };
  });

  const subtotalCents = lines.reduce((s, l) => s + (l.unavailable ? 0 : l.priceCents * l.qty), 0);
  let discountCents = 0;
  let freeShipping = false;
  let coupon: { code: string; ok: boolean; message?: string; title?: string } | null = null;

  if (input.couponCode?.trim()) {
    const res = await evaluateCoupon(input.couponCode, subtotalCents, input.userId, client);
    if (res.ok) {
      discountCents = res.discountCents;
      freeShipping = res.freeShipping;
      coupon = { code: res.coupon.code, ok: true, title: res.coupon.title };
    } else {
      coupon = { code: input.couponCode.trim().toUpperCase(), ok: false, message: res.message };
    }
  }

  const shippingCents = subtotalCents === 0 || freeShipping ? 0 : config.shippingCents[input.shippingMethod];
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  return {
    lines, issues: [...new Set(issues)], coupon,
    subtotalCents, discountCents, shippingCents, totalCents,
    subtotal: toKes(subtotalCents), discount: toKes(discountCents),
    shipping: toKes(shippingCents), total: toKes(totalCents),
  };
}
export type Quote = ReturnType<typeof buildQuote>;

function clampQty(q: number) {
  return Math.max(1, Math.min(10, Math.floor(q) || 1));
}
