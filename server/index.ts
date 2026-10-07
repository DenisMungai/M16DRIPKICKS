import { createApp } from './app';
import { assertRequiredEnvironment, config } from './config';
import { seedIfEmpty } from './seed';
import { initializeDatabase } from './db';
import { expireStaleOrders } from './services/settlement';

assertRequiredEnvironment();
await initializeDatabase();
await seedIfEmpty();

const app = createApp();
app.listen(config.port, () => {
  console.log(`M16DRIPKICKS API on http://localhost:${config.port}  (${config.isProd ? 'production' : 'development'})`);
  console.log(`  M-Pesa: ${config.mpesa.live ? `live (${config.mpesa.env})` : 'demo mode'}   Card: ${config.stripe.enabled ? 'Stripe' : 'demo mode'}`);
});

// Release stock held by unpaid card / M-Pesa orders.
setInterval(() => {
  void expireStaleOrders().then((n) => {
    if (n) console.log(`[orders] released ${n} unpaid order(s)`);
  }).catch((error) => console.error('[orders] could not expire stale orders:', error));
}, 5 * 60_000).unref();
