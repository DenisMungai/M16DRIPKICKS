import type { PoolClient } from 'pg';
import { db, nowIso } from '../db';
import type { OrderRow } from '../models';

export async function getOrder(code: string) {
  const result = await db.query<OrderRow>('SELECT * FROM orders WHERE code = $1', [code]);
  return result.rows[0];
}

async function restock(client: PoolClient, orderId: number) {
  const items = await client.query<{ product_id: number; qty: number }>(
    'SELECT product_id, qty FROM order_items WHERE order_id = $1',
    [orderId],
  );
  for (const item of items.rows) {
    await client.query(
      'UPDATE products SET stock = stock + $1, sold = GREATEST(0, sold - $1) WHERE id = $2',
      [item.qty, item.product_id],
    );
  }
}

export async function markPaid(code: string, ref?: string, receipt?: string) {
  const result = await db.query(`
    UPDATE orders SET payment_status = 'paid', status = 'processing',
      payment_ref = COALESCE($1, payment_ref), mpesa_receipt = COALESCE($2, mpesa_receipt), updated_at = $3
    WHERE code = $4 AND payment_status = 'unpaid' AND status = 'pending' RETURNING id`,
  [ref ?? null, receipt ?? null, nowIso(), code]);
  return (result.rowCount ?? 0) > 0;
}

export async function failPayment(code: string, reason: string) {
  return db.transaction(async (client) => {
    const result = await client.query<OrderRow>('SELECT * FROM orders WHERE code = $1 FOR UPDATE', [code]);
    const order = result.rows[0];
    if (!order || order.payment_status !== 'unpaid' || order.status !== 'pending') return false;
    await client.query(
      `UPDATE orders SET status = 'cancelled', payment_status = 'failed', note = $1, updated_at = $2 WHERE id = $3`,
      [reason, nowIso(), order.id],
    );
    await restock(client, order.id);
    return true;
  });
}

export async function cancelOrder(code: string, reason: string) {
  return db.transaction(async (client) => {
    const result = await client.query<OrderRow>('SELECT * FROM orders WHERE code = $1 FOR UPDATE', [code]);
    const order = result.rows[0];
    if (!order || ['cancelled', 'delivered', 'shipped'].includes(order.status)) return false;
    const paymentStatus = order.payment_status === 'paid'
      ? 'refund_due'
      : order.payment_status === 'unpaid' ? 'failed' : order.payment_status;
    await client.query(
      `UPDATE orders SET status = 'cancelled', payment_status = $1, note = $2, updated_at = $3 WHERE id = $4`,
      [paymentStatus, reason, nowIso(), order.id],
    );
    await restock(client, order.id);
    return true;
  });
}

export async function expireStaleOrders(maxAgeMinutes = 15) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
  const result = await db.query<{ code: string }>(
    `SELECT code FROM orders WHERE status = 'pending' AND payment_status = 'unpaid' AND created_at < $1`,
    [cutoff],
  );
  let count = 0;
  for (const row of result.rows) {
    if (await failPayment(row.code, 'Payment was not completed in time.')) count += 1;
  }
  return count;
}
