import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3001);
const env = (k: string) => (process.env[k] ?? '').trim();

const mpesaKeys = {
  consumerKey: env('MPESA_CONSUMER_KEY'),
  consumerSecret: env('MPESA_CONSUMER_SECRET'),
  shortcode: env('MPESA_SHORTCODE'),
  passkey: env('MPESA_PASSKEY'),
  callbackUrl: env('MPESA_CALLBACK_URL'),
};

export const config = {
  isProd,
  port,
  appUrl: env('APP_URL') || (isProd ? `http://localhost:${port}` : 'http://localhost:5173'),
  databaseUrl: env('DATABASE_URL'),
  legacyDbPath: env('LEGACY_DB_PATH') || './data/novashop.db',
  uploadDir: env('UPLOAD_DIR') || './data/uploads',
  jwtSecret: env('JWT_SECRET') || (isProd ? '' : 'dev-only-secret-change-me'),
  seedDemoData: (env('SEED_DEMO_DATA') || (isProd ? 'false' : 'true')) !== 'false',
  adminEmail: env('ADMIN_EMAIL') || 'admin@novashop.test',
  adminPassword: env('ADMIN_PASSWORD') || (isProd ? '' : 'Admin123!'),
  kesPerUsd: Number(env('KES_PER_USD') || 129),
  shippingCents: { standard: 0, express: 1200 } as const,
  lowStockThreshold: 15,
  stripe: {
    secretKey: env('STRIPE_SECRET_KEY'),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
    enabled: !!env('STRIPE_SECRET_KEY'),
  },
  mpesa: {
    ...mpesaKeys,
    env: (env('MPESA_ENV') || 'sandbox') as 'sandbox' | 'production',
    // Without full Daraja credentials the app runs M-Pesa in demo mode (auto-confirms after a short delay).
    live: Object.values(mpesaKeys).every(Boolean),
    simDelayMs: Number(env('MPESA_SIM_DELAY_MS') || 5000),
  },
};

if (isProd && !config.jwtSecret) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production.');
}
