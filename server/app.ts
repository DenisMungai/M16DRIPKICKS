import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { COOKIE_NAME, readSession } from './auth.js';
import { config } from './config.js';
import { db } from './db.js';
import { createContext } from './context.js';
import { appRouter } from './router.js';
import { handleMpesaCallback, handleStripeEvent } from './services/payments.js';

function sniffImage(b: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1'))) return 'gif';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

function isAllowedOrigin(value: string): boolean {
  let origin: string;
  try {
    origin = new URL(value).origin;
  } catch {
    return false;
  }
  if (origin === new URL(config.appUrl).origin) return true;
  return !config.isProd && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin);
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  if (process.env.VERCEL) {
    app.use((req, _res, next) => {
      const requestPath = (url: string) => new URL(url, 'http://vercel.local').pathname;
      console.info('[express] request path', {
        method: req.method,
        reqUrl: requestPath(req.url),
        reqPath: req.path,
        reqOriginalUrl: requestPath(req.originalUrl),
      });
      next();
    });
  }
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://js.stripe.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://api.stripe.com', 'https://js.stripe.com'],
        frameSrc: ['https://js.stripe.com', 'https://checkout.stripe.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isApiRoute = req.path.startsWith('/trpc') || req.path.startsWith('/api');
    if (origin && isApiRoute && !req.path.startsWith('/api/stripe/webhook') && !req.path.startsWith('/api/mpesa/callback')) {
      if (!isAllowedOrigin(origin)) {
        return res.status(403).json({ error: 'Origin not allowed.', code: 'ORIGIN_NOT_ALLOWED' });
      }
    }
    const corsOrigin = origin && isApiRoute && isAllowedOrigin(origin) ? new URL(origin).origin : config.appUrl;
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (req.method !== 'GET' && !req.path.startsWith('/api/stripe/webhook') && !req.path.startsWith('/api/mpesa/callback')) {
      if (!req.is('application/json')) {
        return res.status(415).json({ error: 'Content-Type must be application/json.' });
      }
      const referrer = req.headers.referer || req.headers.origin;
      if (referrer) {
        if (!isAllowedOrigin(referrer)) {
          return res.status(403).json({ error: 'Request origin mismatch.', code: 'ORIGIN_NOT_ALLOWED' });
        }
      }
    }
    next();
  });

  // Stripe needs the raw body to verify the signature, so this route comes before express.json().
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      await handleStripeEvent(req.body as Buffer, req.header('stripe-signature'));
      res.json({ received: true });
    } catch (e) {
      console.warn('[stripe] webhook rejected:', (e as Error).message);
      res.status(400).send('Webhook error');
    }
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.post('/api/mpesa/callback', (req, res) => {
    // Acknowledge immediately; Daraja retries if it does not get a quick 200.
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    handleMpesaCallback(req.body).catch((e) => console.warn('[mpesa] callback error:', e));
  });


  // Admin-only product photo upload. The file type is checked from the bytes, never from the file name.
  const uploadDir = path.resolve(config.uploadDir);
  const photo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('image');
  app.post('/api/upload', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const id = readSession(req.cookies?.[COOKIE_NAME]);
    const result = id ? await db.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [id]) : null;
    const user = result?.rows[0];
    if (!user) return res.status(401).json({ error: 'Sign in to upload photos.' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
    photo(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photos must be 5 MB or smaller.' : 'Upload failed.' });
      const buf = req.file?.buffer;
      if (!buf) return res.status(400).json({ error: 'Choose a photo to upload.' });
      const ext = sniffImage(buf);
      if (!ext) return res.status(400).json({ error: 'Use a JPG, PNG, WebP or GIF photo.' });
      fs.mkdirSync(uploadDir, { recursive: true });
      const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(uploadDir, name), buf);
      res.json({ url: `/uploads/${name}` });
    });
  });
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d', index: false, dotfiles: 'deny' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const trpcRateLimit = rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false });
  const trpcMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ path, error }) {
      console.error('[trpc] request failed', { path, code: error.code, message: error.message });
    },
  });

  app.use(['/trpc', '/api/trpc'], trpcRateLimit);
  app.use(['/trpc', '/api/trpc'], trpcMiddleware);

  const dist = path.resolve('dist');
  if (config.isProd && fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!trpc|api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}
