import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { db, nowIso } from '../db';
import type { OrderRow, UserRow } from '../models';
import { buildQuote, type LineInput, type ShippingMethod } from './pricing';
import { startCard, startMpesa } from './payments';
import { failPayment, getOrder } from './settlement';

export type CreateOrderInput = {
  items: LineInput[];
  couponCode?: string | null;
  shippingMethod: ShippingMethod;
  paymentMethod: 'card' | 'mpesa' | 'cod';
  mpesaPhone?: string;
  address: { name: string; phone: string; line1: string; line2?: string | null; city: string; country: string };
  saveAddress?: boolean;
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => {
  const bytes = crypto.randomBytes(6);
  return `NS-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
};

export async function createOrder(user: UserRow, input: CreateOrderInput) {
  if (!input.items.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Your cart is empty.' });

  const code = await db.transaction(async (client) => {
    const quote = await buildQuote({ ...input, userId: user.id }, client);
    if (quote.issues.length) throw new TRPCError({ code: 'BAD_REQUEST', message: quote.issues[0] });
    if (quote.coupon && !quote.coupon.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: quote.coupon.message ?? 'Invalid coupon.' });

    const orderCode = newCode();
    const a = input.address;
    const cod = input.paymentMethod === 'cod';
    const res = await client.query<{ id: number }>(`
      INSERT INTO orders (code, user_id, status, payment_method, payment_status, subtotal_cents, discount_cents,
        shipping_cents, total_cents, coupon_code, shipping_method, email, ship_name, ship_phone, ship_line, ship_city, ship_country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`, [
      orderCode, user.id, cod ? 'processing' : 'pending', input.paymentMethod, cod ? 'cod' : 'unpaid',
      quote.subtotalCents, quote.discountCents, quote.shippingCents, quote.totalCents,
      quote.coupon?.ok ? quote.coupon.code : null, input.shippingMethod, user.email,
      a.name, a.phone, [a.line1, a.line2].filter(Boolean).join(', '), a.city, a.country,
    ]);
    const orderId = res.rows[0].id;

    for (const l of quote.lines) {
      if (l.unavailable) continue;
      await client.query(
        'INSERT INTO order_items (order_id, product_id, name, sku, price_cents, qty, size, color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [orderId, l.productId, l.name, l.sku, l.priceCents, l.qty, l.size, l.color],
      );
      const taken = await client.query(
        'UPDATE products SET stock = stock - $1::integer, sold = sold + $1::integer WHERE id = $2 AND stock >= $1::integer',
        [l.qty, l.productId],
      );
      if (!taken.rowCount) {
        throw new TRPCError({ code: 'CONFLICT', message: `${l.name} just sold out. Please update your cart.` });
      }
    }

    if (input.saveAddress) {
      const existing = await client.query<{ n: number }>('SELECT COUNT(*)::integer AS n FROM addresses WHERE user_id = $1', [user.id]);
      const hasAddress = existing.rows[0].n > 0;
      await client.query(`INSERT INTO addresses (user_id, label, name, phone, line1, line2, city, country, is_default)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [user.id, hasAddress ? 'Saved address' : 'Home', a.name, a.phone, a.line1, a.line2 ?? null, a.city, a.country, hasAddress ? 0 : 1]);
    }
    return orderCode;
  });

  const order = await getOrder(code) as OrderRow;
  try {
    if (input.paymentMethod === 'cod') return { code, redirectUrl: null as string | null, mode: 'cod' as const };

    if (input.paymentMethod === 'card') {
      const items = await db.query<{ name: string; qty: number }>('SELECT name, qty FROM order_items WHERE order_id = $1', [order.id]);
      const summary = items.rows
        .map((i) => `${i.qty} × ${i.name}`).join(', ');
      const r = await startCard(order, summary);
      return { code, redirectUrl: r.url, mode: r.mode };
    }

    const r = await startMpesa(order, input.mpesaPhone ?? '');
    if (input.mpesaPhone) await db.query('UPDATE users SET mpesa_phone = $1 WHERE id = $2', [input.mpesaPhone, user.id]);
    return { code, redirectUrl: null, mode: r.mode };
  } catch (e) {
    await failPayment(code, 'Could not start the payment.');
    if (e instanceof TRPCError) throw e;
    console.error('[orders] payment start failed:', e);
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'We could not start the payment. You have not been charged. Please try again.' });
  }
}

export async function setOrderStatus(code: string, status: OrderRow['status'], tracking?: string | null) {
  const o = await getOrder(code);
  if (!o) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
  const order = ['pending', 'processing', 'shipped', 'delivered'];
  if (o.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'This order is cancelled.' });
  if (status !== 'cancelled' && order.indexOf(status) < order.indexOf(o.status)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'An order cannot move backwards.' });
  }
  if (status === 'shipped' && !(tracking ?? o.tracking)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Add a tracking number before marking as shipped.' });
  }
  // Cash on delivery is collected when the parcel arrives.
  const pay = status === 'delivered' && o.payment_status === 'cod' ? 'paid' : o.payment_status;
  await db.query('UPDATE orders SET status = $1, payment_status = $2, tracking = COALESCE($3, tracking), updated_at = $4 WHERE id = $5',
    [status, pay, tracking ?? null, nowIso(), o.id]);
}
