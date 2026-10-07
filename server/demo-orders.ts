import type { PoolClient } from 'pg';
import { db } from './db';

export async function removeDemoOrders(database: Pick<typeof db, 'transaction'> = db) {
  return database.transaction(async (client: PoolClient) => {
    const items = await client.query<{ count: number }>(`
      SELECT COUNT(*)::integer AS count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_ref LIKE 'SEED-%'`);
    const orders = await client.query(
      `DELETE FROM orders WHERE payment_ref LIKE 'SEED-%'`,
    );

    return {
      deletedOrders: orders.rowCount ?? 0,
      deletedOrderItems: items.rows[0].count,
    };
  });
}
