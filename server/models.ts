import { db } from './db';
import { config } from './config';
import type { PoolClient } from 'pg';

export const toUsd = (cents: number) => Math.round(cents) / 100;
export const toCents = (usd: number) => Math.round(usd * 100);
export const toKes = (usdCents: number) => Math.round(toUsd(usdCents) * config.kesPerUsd);
export const fromKes = (kes: number) => toCents(kes / config.kesPerUsd);

export type ProductRow = {
  id: number; sku: string; name: string; sub: string; description: string;
  category_id: number; brand_id: number | null; price_cents: number; was_cents: number | null;
  badge: string | null; is_new: number; rating: number; review_count: number; stock: number; sold: number;
  image: string | null; sizes: string; colors: string; active: number; created_at: string;
  category: string; category_slug: string; brand: string | null;
};

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category, c.slug AS category_slug, b.name AS brand
  FROM products p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN brands b ON b.id = p.brand_id`;

const parse = <T>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export function productDto(r: ProductRow) {
  const sizes = parse<string[]>(r.sizes, []);
  const colors = parse<{ name: string; swatch: string }[]>(r.colors, []);
  const discountPct = r.was_cents && r.was_cents > r.price_cents
    ? Math.round((1 - r.price_cents / r.was_cents) * 100) : 0;
  return {
    id: r.id, sku: r.sku, name: r.name, sub: r.sub, description: r.description,
    category: r.category, categorySlug: r.category_slug, brand: r.brand,
    price: toKes(r.price_cents), was: r.was_cents ? toKes(r.was_cents) : null,
    discountPct, badge: r.badge, isNew: !!r.is_new, rating: r.rating, reviews: r.review_count,
    stock: r.stock, sold: r.sold, image: r.image, sizes, colors, active: !!r.active,
    createdAt: r.created_at,
  };
}
export type ProductDto = ReturnType<typeof productDto>;

export async function getProductRows(ids: number[], client?: PoolClient): Promise<ProductRow[]> {
  if (!ids.length) return [];
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
  const q = `${PRODUCT_SELECT} WHERE p.id IN (${placeholders})`;
  const result = client ? await client.query<ProductRow>(q, ids) : await db.query<ProductRow>(q, ids);
  return result.rows;
}

export type UserRow = {
  id: number; email: string; name: string; phone: string | null; mpesa_phone: string | null;
  password_hash: string; role: 'customer' | 'admin'; created_at: string;
};
export const userDto = (u: UserRow) => ({
  id: u.id, email: u.email, name: u.name, phone: u.phone, mpesaPhone: u.mpesa_phone, role: u.role,
});
export type UserDto = ReturnType<typeof userDto>;

export type OrderRow = {
  id: number; code: string; user_id: number; status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method: 'card' | 'mpesa' | 'cod'; payment_status: 'unpaid' | 'paid' | 'cod' | 'failed' | 'refund_due';
  payment_ref: string | null; mpesa_receipt: string | null;
  subtotal_cents: number; discount_cents: number; shipping_cents: number; total_cents: number;
  coupon_code: string | null; shipping_method: string; email: string;
  ship_name: string; ship_phone: string; ship_line: string; ship_city: string; ship_country: string;
  tracking: string | null; note: string | null; created_at: string; updated_at: string;
};

type ItemRow = {
  product_id: number; name: string; sku: string; price_cents: number; qty: number;
  size: string | null; color: string | null; image: string | null; category: string | null;
};

export async function orderDto(o: OrderRow) {
  const result = await db.query<ItemRow>(`
    SELECT oi.product_id, oi.name, oi.sku, oi.price_cents, oi.qty, oi.size, oi.color, p.image, c.name AS category
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE oi.order_id = $1 ORDER BY oi.id`, [o.id]);
  const items = result.rows;
  return {
    code: o.code, status: o.status, paymentMethod: o.payment_method, paymentStatus: o.payment_status,
    mpesaReceipt: o.mpesa_receipt,
    subtotal: toKes(o.subtotal_cents), discount: toKes(o.discount_cents), shipping: toKes(o.shipping_cents),
    total: toKes(o.total_cents), couponCode: o.coupon_code, shippingMethod: o.shipping_method,
    email: o.email, shipName: o.ship_name, shipPhone: o.ship_phone, shipLine: o.ship_line,
    shipCity: o.ship_city, shipCountry: o.ship_country, tracking: o.tracking,
    createdAt: o.created_at, updatedAt: o.updated_at,
    items: items.map((i) => ({
      productId: i.product_id, name: i.name, sku: i.sku, price: toKes(i.price_cents), qty: i.qty,
      size: i.size, color: i.color, image: i.image, category: i.category,
    })),
  };
}
export type OrderDto = ReturnType<typeof orderDto>;
