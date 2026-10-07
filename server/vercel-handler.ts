import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createApp } from './app';
import { assertRequiredEnvironment } from './config';
import { initializeDatabase } from './db';
import { seedIfEmpty } from './seed';

type InitializationStage = 'environment' | 'database/migrations' | 'seeding' | 'Express app construction';

class ApiInitializationError extends Error {
  constructor(readonly stage: InitializationStage, cause: unknown) {
    super(`API initialization failed during ${stage}.`, { cause });
    this.name = 'ApiInitializationError';
  }
}

let appPromise: Promise<Express> | undefined;

type VercelRequest = IncomingMessage & {
  url?: string;
};

type VercelResponse = ServerResponse & {
  status(code: number): VercelResponse;
  json(body: unknown): void;
};

async function initializeApp() {
  let stage: InitializationStage = 'environment';
  try {
    assertRequiredEnvironment();
    stage = 'database/migrations';
    await initializeDatabase();
    stage = 'seeding';
    await seedIfEmpty();
    stage = 'Express app construction';
    const app = createApp();
    console.info('[vercel-api] initialization complete');
    return app;
  } catch (error) {
    console.error(`[vercel-api] initialization failed during ${stage}`, error);
    throw new ApiInitializationError(stage, error);
  }
}

function ensureApp() {
  if (!appPromise) {
    appPromise = initializeApp().catch((error: unknown) => {
      appPromise = undefined;
      throw error;
    });
  }
  return appPromise;
}

export default async function handleVercelRequest(req: VercelRequest, res: VercelResponse) {
  const receivedUrl = new URL(req.url ?? '/', 'http://vercel.local');
  const receivedPath = receivedUrl.pathname;
  const hadApiPrefix = /^\/api(?:\/|$)/.test(receivedUrl.pathname);
  if (!hadApiPrefix) {
    receivedUrl.pathname = `/api${receivedUrl.pathname === '/' ? '' : receivedUrl.pathname}`;
    req.url = `${receivedUrl.pathname}${receivedUrl.search}`;
  }

  console.info('[vercel-api] incoming request', {
    method: req.method,
    receivedPath,
    expressUrlPath: receivedUrl.pathname,
    normalizedApiPrefix: hadApiPrefix ? 'preserved' : 'added',
  });

  let app;
  try {
    app = await ensureApp();
  } catch (error) {
    const stage = error instanceof ApiInitializationError ? error.stage : 'unknown';
    res.status(500).json({ error: 'API initialization failed.', stage });
    return;
  }

  app(req as never, res as never);
}
