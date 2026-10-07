import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';

type InitializationStage = 'environment' | 'database/migrations' | 'seeding' | 'Express app construction';

class ApiInitializationError extends Error {
  constructor(readonly stage: InitializationStage, cause: unknown) {
    super(`API initialization failed during ${stage}.`, { cause });
    this.name = 'ApiInitializationError';
  }
}

type VercelRequest = IncomingMessage & {
  url?: string;
};

type VercelResponse = ServerResponse;

let cachedApp: Express | undefined;
let appPromise: Promise<Express> | undefined;
let databasePromise: Promise<void> | undefined;

async function getApp(): Promise<Express> {
  if (cachedApp) return cachedApp;
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const { createApp } = await import('./app.js');
        cachedApp = createApp();
        console.info('[vercel-api] Express app constructed');
        return cachedApp;
      } catch (error) {
        console.error('[vercel-api] Express app construction failed', error);
        throw new ApiInitializationError('Express app construction', error);
      }
    })().catch((error: unknown) => {
      appPromise = undefined;
      throw error;
    });
  }
  return appPromise;
}

async function initializeDatabaseAndSeed() {
  let stage: InitializationStage = 'environment';
  try {
    const { assertRequiredEnvironment } = await import('./config.js');
    assertRequiredEnvironment();
    stage = 'database/migrations';
    const { initializeDatabase } = await import('./db.js');
    await initializeDatabase();
    stage = 'seeding';
    const { seedIfEmpty } = await import('./seed.js');
    await seedIfEmpty();
    console.info('[vercel-api] database initialization complete');
  } catch (error) {
    console.error(`[vercel-api] initialization failed during ${stage}`, error);
    throw new ApiInitializationError(stage, error);
  }
}

function ensureDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabaseAndSeed().catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

function sendInitializationError(res: VercelResponse, error: unknown) {
  const stage = error instanceof ApiInitializationError ? error.stage : 'unknown';
  res.statusCode = 500;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'API initialization failed.', stage }));
}

function dispatch(app: Express, req: VercelRequest, res: VercelResponse) {
  try {
    app(req as never, res as never);
  } catch (error) {
    console.error('[vercel-api] Express request dispatch failed', error);
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : new Error('Express request dispatch failed.'));
      return;
    }
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Express request dispatch failed.' }));
  }
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

  if (req.method === 'GET' && receivedUrl.pathname === '/api/health') {
    try {
      const app = await getApp();
      dispatch(app, req, res);
    } catch (error) {
      sendInitializationError(res, error);
    }
    return;
  }

  try {
    await ensureDatabase();
    const app = await getApp();
    dispatch(app, req, res);
  } catch (error) {
    sendInitializationError(res, error);
  }
}
