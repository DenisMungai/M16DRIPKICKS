import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { newDb } from 'pg-mem';
import type { AppRouter } from '../router.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://localhost:5432/test';
process.env.APP_URL = 'http://localhost:5173/';
process.env.SEED_DEMO_DATA = 'false';

let server: Server;
let baseUrl: string;
let trpcClient: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
let initializeTestDatabase: () => Promise<void>;

before(async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const TestPool = memory.adapters.createPg().Pool;
  const database = await import('../db.js');
  database.setPoolForTests(new TestPool() as unknown as import('pg').Pool);
  initializeTestDatabase = async () => {
    await database.initializeDatabase((sql) => sql.replaceAll('DEFAULT CURRENT_TIMESTAMP::text', "DEFAULT '2026-01-01T00:00:00.000Z'"));
    const { seedIfEmpty } = await import('../seed.js');
    await seedIfEmpty();
  };
  const { default: handleVercelRequest } = await import('../vercel-handler.js');
  server = createServer((req, res) => {
    void handleVercelRequest(req as never, res as never);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
  trpcClient = createTRPCProxyClient<AppRouter>({
    links: [httpBatchLink({ url: `${baseUrl}/api/trpc` })],
  });
});

after(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('Vercel API routing', () => {
  it('serves the Express health route through the function handler', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it('returns a tRPC envelope for unauthenticated auth.me', async () => {
    await initializeTestDatabase();
    const { config } = await import('../config.js');
    assert.equal(config.appUrl, 'http://localhost:5173');
    const response = await fetch(`${baseUrl}/api/trpc/auth.me`);
    assert.equal(response.status, 200);
    const body = await response.json() as { result?: { data?: unknown } };
    const data = body.result?.data;
    assert.equal(
      typeof data === 'object' && data !== null && 'json' in data
        ? (data as { json: unknown }).json
        : data,
      null,
    );
  });

  it('serves batched tRPC catalog, product list, and detail queries from the database', async () => {
    const requestUrls: string[] = [];
    const batchClient = createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        fetch(input, init) {
          requestUrls.push(String(input));
          return fetch(input, init);
        },
      })],
    });
    const [me, batchCategories, home] = await Promise.all([
      batchClient.auth.me.query(),
      batchClient.catalog.categories.query(),
      batchClient.catalog.home.query(),
    ]);
    assert.equal(requestUrls.length, 1);
    assert.equal(new URL(requestUrls[0]).pathname, '/api/trpc/auth.me,catalog.categories,catalog.home');
    assert.equal(me, null);
    assert.deepEqual(batchCategories.map(({ name }) => name), ['Footwear', 'Apparel']);
    assert.ok(home && 'newArrivals' in home && 'bestSellers' in home && 'deals' in home);

    const categories = await trpcClient.catalog.categories.query();
    assert.deepEqual(categories.map(({ name }) => name), ['Footwear', 'Apparel']);

    const products = await trpcClient.catalog.products.list.query({ limit: 100 });
    assert.equal(products.total, 29);
    assert.equal(products.items.length, 29);

    const detail = await trpcClient.catalog.products.byId.query({ id: products.items[0].id });
    assert.equal(detail.id, products.items[0].id);
    assert.equal(detail.name, products.items[0].name);

    const loginRequestUrls: string[] = [];
    const localOriginClient = createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        fetch(input, init) {
          loginRequestUrls.push(String(input));
          const headers = new Headers(init?.headers);
          headers.set('Origin', 'http://localhost:5173');
          headers.set('Referer', 'http://localhost:5173/login');
          return fetch(input, { ...init, headers });
        },
      })],
    });
    const registered = await localOriginClient.auth.register.mutate({
      name: 'HTTP Sign In',
      email: 'http-sign-in@example.test',
      password: 'Secret123!',
    });
    const signedIn = await localOriginClient.auth.login.mutate({
      email: registered.email,
      password: 'Secret123!',
    });
    assert.equal(signedIn.id, registered.id);
    assert.ok(loginRequestUrls.some((requestUrl) => new URL(requestUrl).pathname.endsWith('/auth.login')));
    await assert.rejects(
      trpcClient.auth.login.mutate({ email: registered.email, password: 'incorrect-password' }),
      (error: { data?: { code?: string } }) => error.data?.code === 'UNAUTHORIZED',
    );

    const rejectedOrigin = await fetch(`${baseUrl}/api/trpc/auth.me`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(rejectedOrigin.status, 403);
    assert.deepEqual(await rejectedOrigin.json(), {
      error: 'Origin not allowed.',
      code: 'ORIGIN_NOT_ALLOWED',
    });
  });
});
