import 'dotenv/config';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3001);
const env = (k: string) => (process.env[k] ?? '').trim();
const normalizeAppUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password) {
      return url.origin;
    }
  } catch {
    // Validation below reports malformed values with the environment variable name.
  }
  return value;
};
const paymentsDemoMode = env('PAYMENTS_DEMO_MODE') === 'true';

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
  paymentsDemoMode,
  appUrl: normalizeAppUrl(env('APP_URL') || (isProd ? '' : 'http://localhost:5173')),
  databaseUrl: env('DATABASE_URL') || 'postgresql://localhost:5432/m16dripkicks',
  legacyDbPath: env('LEGACY_DB_PATH') || './data/novashop.db',
  uploadDir: env('UPLOAD_DIR') || './data/uploads',
  jwtSecret: env('JWT_SECRET') || 'dev-only-secret-change-me-1234567890',
  seedDemoData: (env('SEED_DEMO_DATA') || (isProd ? 'false' : 'true')) !== 'false',
  adminEmail: env('ADMIN_EMAIL') || 'admin@novashop.test',
  adminPassword: env('ADMIN_PASSWORD') || (isProd ? '' : 'Admin123!'),
  kesPerUsd: Number(env('KES_PER_USD') || 129),
  shippingCents: { standard: 0, express: 1200 } as const,
  lowStockThreshold: 15,
  stripe: {
    secretKey: env('STRIPE_SECRET_KEY'),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
    enabled: !!env('STRIPE_SECRET_KEY') && (!isProd || paymentsDemoMode),
  },
  mpesa: {
    ...mpesaKeys,
    env: (env('MPESA_ENV') || 'sandbox') as 'sandbox' | 'production',
    live: Object.values(mpesaKeys).every(Boolean),
    simDelayMs: Number(env('MPESA_SIM_DELAY_MS') || 5000),
  },
};

export function assertAppUrl() {
  if (config.isProd && !env('APP_URL')) {
    throw new Error('APP_URL is required in production and must be the exact public HTTPS origin.');
  }
  if (!config.appUrl) return;

  let appUrl: URL;
  try {
    appUrl = new URL(config.appUrl);
  } catch {
    throw new Error('APP_URL must be a valid origin URL.');
  }

  if (config.isProd && (appUrl.protocol !== 'https:' || appUrl.pathname !== '/' || appUrl.search || appUrl.hash || appUrl.username || appUrl.password)) {
    throw new Error('APP_URL must be the exact public HTTPS origin, without a path, query, or credentials.');
  }
}

export function assertRequiredEnvironment() {
  const isDemoModeAllowed = !config.isProd || config.paymentsDemoMode;
  const requiredSchema = z.object({
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().min(1, 'APP_URL is required.').url(),
    JWT_SECRET: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    MPESA_CONSUMER_KEY: z.string().min(1).optional(),
    MPESA_CONSUMER_SECRET: z.string().min(1).optional(),
    MPESA_SHORTCODE: z.string().min(1).optional(),
    MPESA_PASSKEY: z.string().min(1).optional(),
    MPESA_CALLBACK_URL: z.string().url().optional(),
  });

  const parsed = requiredSchema.safeParse({
    DATABASE_URL: config.databaseUrl,
    APP_URL: config.appUrl,
    JWT_SECRET: config.jwtSecret,
    STRIPE_SECRET_KEY: config.stripe.secretKey || undefined,
    STRIPE_WEBHOOK_SECRET: config.stripe.webhookSecret || undefined,
    MPESA_CONSUMER_KEY: config.mpesa.consumerKey || undefined,
    MPESA_CONSUMER_SECRET: config.mpesa.consumerSecret || undefined,
    MPESA_SHORTCODE: config.mpesa.shortcode || undefined,
    MPESA_PASSKEY: config.mpesa.passkey || undefined,
    MPESA_CALLBACK_URL: config.mpesa.callbackUrl || undefined,
  });

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join('.') || issue.message).join(', ')}.`);
  }

  if (config.isProd) {
    if (!config.jwtSecret || config.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long in production.');
    }
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is required in production.');
    }
    const appUrl = new URL(config.appUrl);
    if (appUrl.protocol !== 'https:' || appUrl.pathname !== '/' || appUrl.search || appUrl.hash || appUrl.username || appUrl.password) {
      throw new Error('APP_URL must be the exact public HTTPS origin, without a path, query, or credentials.');
    }
    if (!config.paymentsDemoMode && (!config.mpesa.live || !config.stripe.enabled)) {
      throw new Error('Payments are disabled in production; set PAYMENTS_DEMO_MODE=true or provide the required payment keys.');
    }
    if (config.paymentsDemoMode && !config.mpesa.live && !config.stripe.enabled) {
      throw new Error('PAYMENTS_DEMO_MODE=true requires at least one configured payment provider in production.');
    }

    if (config.isProd && config.adminPassword && config.adminPassword.length < 12) {
      throw new Error('ADMIN_PASSWORD must be at least 12 characters in production.');
    }
    if (!config.adminPassword) {
      throw new Error('ADMIN_PASSWORD must be set in production.');
    }
  }

  if (!isDemoModeAllowed && config.isProd && (config.mpesa.live || config.stripe.enabled)) {
    return;
  }
}
