import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { newDb } from 'pg-mem';
import type { AppRouter } from '../router';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://localhost:5432/test';
process.env.SEED_DEMO_DATA = 'false';

let server: Server;
let baseUrl: string;
let trpcClient: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
let initializeTestDatabase: () => Promise<void>;

before(async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const TestPool = memory.adapters.createPg().Pool;
  const database = await import('../db');
  database.setPoolForTests(new TestPool() as unknown as import('pg').Pool);
  initializeTestDatabase = async () => {
    await database.initializeDatabase((sql) => sql.replaceAll('DEFAULT CURRENT_TIMESTAMP::text', "DEFAULT '2026-01-01T00:00:00.000Z'"));
    const { seedIfEmpty } = await import('../seed');
    await seedIfEmpty();
  };
  const { default: handleVercelRequest } = await import('../vercel-handler');
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

  it('serves batched tRPC catalog, product list, and detail queries from the database', async () => {
    await initializeTestDatabase();
    const categories = await trpcClient.catalog.categories.query();
    assert.deepEqual(categories.map(({ name }) => name), ['Footwear', 'Apparel']);

    const products = await trpcClient.catalog.products.list.query({ limit: 100 });
    assert.equal(products.total, 29);
    assert.equal(products.items.length, 29);

    const detail = await trpcClient.catalog.products.byId.query({ id: products.items[0].id });
    assert.equal(detail.id, products.items[0].id);
    assert.equal(detail.name, products.items[0].name);
  });
});
