import { closeDatabase } from './db';
import { removeDemoOrders } from './demo-orders';

removeDemoOrders()
  .then(({ deletedOrders, deletedOrderItems }) => {
    console.log(`[demo data] Removed ${deletedOrders} seeded orders and ${deletedOrderItems} order items.`);
  })
  .catch((error: unknown) => {
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[demo data] Could not remove seeded orders (${name}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
