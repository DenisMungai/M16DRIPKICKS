import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server/app';
import { initializeDatabase } from '../server/db';
import { seedIfEmpty } from '../server/seed';

let cachedApp: ReturnType<typeof createApp> | null = null;
let initialized = false;

async function ensureApp() {
  if (!initialized || !cachedApp) {
    try {
      await initializeDatabase();
      await seedIfEmpty();
      cachedApp = createApp();
      initialized = true;
    } catch (error) {
      console.error('[vercel-api] initialization failure:', error);
      throw error;
    }
  }

  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await ensureApp();
    return app(req as never, res as never);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const details = error instanceof Error && 'cause' in error && error.cause ? String(error.cause) : undefined;

    res.status(500).json({
      error: 'API initialization failed.',
      message,
      ...(details ? { details } : {}),
    });
    return;
  }
}
