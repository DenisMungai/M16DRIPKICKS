import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { COOKIE_NAME, readSession } from './auth';
import { config } from './config';
import { db } from './db';
import { createContext } from './context';
import { appRouter } from './router';
import { handleMpesaCallback, handleStripeEvent } from './services/payments';

function sniffImage(b: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1'))) return 'gif';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
  }));

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
  const trpcMiddleware = createExpressMiddleware({ router: appRouter, createContext });

  app.use(['/trpc', '/api/trpc'], trpcRateLimit);
  app.use(['/trpc', '/api/trpc'], trpcMiddleware);

  const dist = path.resolve('dist');
  if (config.isProd && fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!trpc|api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}
