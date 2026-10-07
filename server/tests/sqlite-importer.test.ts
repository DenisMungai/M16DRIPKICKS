import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Database from 'better-sqlite3';
import { newDb } from 'pg-mem';
import type { Pool, PoolClient } from 'pg';
import { after, describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SQLITE_IMPORT_TABLES, importSqliteData } from '../sqlite-importer.js';
import type { db } from '../db.js';

const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations/001_initial.sql');
const targets: Pool[] = [];
const sources: Database.Database[] = [];

function createSource(invalidProductReference = false) {
  const source = new Database(':memory:');
  sources.push(source);
  const numericColumns = new Set([
    'id', 'category_id', 'brand_id', 'user_id', 'coupon_id', 'order_id', 'product_id', 'price_cents', 'was_cents',
    'is_new', 'rating', 'review_count', 'stock', 'sold', 'active', 'subtotal_cents', 'discount_cents',
    'shipping_cents', 'total_cents', 'qty', 'value', 'min_spend_cents', 'one_per_user', 'auto_grant', 'is_default',
  ]);
  for (const [table, columns] of Object.entries(SQLITE_IMPORT_TABLES)) {
    const definitions = columns.map((column) => `"${column}" ${numericColumns.has(column) ? 'NUMERIC' : 'TEXT'}`).join(', ');
    source.exec(`CREATE TABLE "${table}" (${definitions})`);
  }
  const add = (table: keyof typeof SQLITE_IMPORT_TABLES, row: Record<string, unknown>) => {
    const columns = SQLITE_IMPORT_TABLES[table];
    const placeholders = columns.map(() => '?').join(',');
    source.prepare(`INSERT INTO "${table}" (${columns.join(',')}) VALUES (${placeholders})`)
      .run(...columns.map((column) => row[column] ?? null));
  };

  add('categories', { id: 10, name: 'Footwear', slug: 'footwear' });
  add('brands', { id: 20, name: 'M16DRIPKICKS', blurb: 'Local store', cta: 'Shop now' });
  add('users', {
    id: 30, email: 'customer@example.test', name: 'Test Customer', phone: '0712345678',
    mpesa_phone: null, password_hash: 'preserved-hash', role: 'customer', created_at: '2026-01-01T00:00:00.000Z',
  });
  add('products', {
    id: 40, sku: 'TEST-SHOE', name: 'Test Shoe', sub: 'Everyday', description: 'A test product',
    category_id: invalidProductReference ? 999 : 10, brand_id: 20, price_cents: 1000, was_cents: null,
    badge: null, is_new: 1, rating: 4.5, review_count: 3, stock: 5, sold: 1, image: '/shoe.jpg',
    sizes: '[]', colors: '[]', active: 1, created_at: '2026-01-01T00:00:00.000Z',
  });
  add('coupons', {
    id: 50, code: 'TEST10', tag: 'Offer', title: 'Test coupon', note: '', type: 'percent', value: 10,
    min_spend_cents: 0, expires_at: null, one_per_user: 1, auto_grant: 0, active: 1,
  });
  add('orders', {
    id: 60, code: 'NS-TEST01', user_id: 30, status: 'processing', payment_method: 'cod', payment_status: 'cod',
    payment_ref: null, mpesa_receipt: null, subtotal_cents: 1000, discount_cents: 0, shipping_cents: 0,
    total_cents: 1000, coupon_code: null, shipping_method: 'standard', email: 'customer@example.test',
    ship_name: 'Test Customer', ship_phone: '0712345678', ship_line: 'Test Street', ship_city: 'Nairobi',
    ship_country: 'Kenya', tracking: null, note: null, created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  add('order_items', {
    id: 70, order_id: 60, product_id: 40, name: 'Test Shoe', sku: 'TEST-SHOE',
    price_cents: 1000, qty: 1, size: '8', color: 'Black',
  });
  add('wishlist', { user_id: 30, product_id: 40, created_at: '2026-01-01T00:00:00.000Z' });
  add('user_coupons', { user_id: 30, coupon_id: 50 });
  add('addresses', {
    id: 80, user_id: 30, label: 'Home', name: 'Test Customer', phone: '0712345678',
    line1: 'Test Street', line2: null, city: 'Nairobi', country: 'Kenya', is_default: 1,
  });
  return source;
}

async function createTarget() {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const PgPool = memory.adapters.createPg().Pool;
  const pool = new PgPool() as unknown as Pool;
  targets.push(pool);
  const migration = (await fs.readFile(migrationPath, 'utf8'))
    .replaceAll('DEFAULT CURRENT_TIMESTAMP::text', "DEFAULT '2026-01-01T00:00:00.000Z'");
  await pool.query(migration);
  const state = { rolledBack: false, identityRestarts: new Map<string, number>() };
  const target: Pick<typeof db, 'transaction'> = {
    async transaction<T>(run: (client: PoolClient) => Promise<T>) {
      const client = await pool.connect();
      const wrapped = new Proxy(client, {
        get(targetClient, property, receiver) {
          if (property === 'query') {
            return (text: string, values?: readonly unknown[]) => {
              const restart = /^ALTER TABLE (\w+) ALTER COLUMN id RESTART WITH (\d+)$/.exec(text);
              if (restart) {
                state.identityRestarts.set(restart[1], Number(restart[2]));
                return Promise.resolve({ rows: [], rowCount: 0 });
              }
              return targetClient.query(text, values ? [...values] : []);
            };
          }
          return Reflect.get(targetClient, property, receiver);
        },
      });
      try {
        await client.query('BEGIN');
        const result = await run(wrapped);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        state.rolledBack = true;
        throw error;
      } finally {
        client.release();
      }
    },
  };
  return { pool, target, state };
}

after(async () => {
  for (const source of sources) source.close();
  await Promise.all(targets.map((pool) => pool.end()));
});

describe('SQLite import', () => {
  it('preserves rows and relationships, advances identities, and refuses a repeat import', async () => {
    const source = createSource();
    const { pool, target, state } = await createTarget();
    const counts = await importSqliteData(source, target);
    assert.deepEqual(Object.values(counts), Array(10).fill(1));
    assert.equal((await pool.query('SELECT id, password_hash FROM users WHERE id = 30')).rows[0].password_hash, 'preserved-hash');
    assert.equal((await pool.query('SELECT user_id, product_id FROM wishlist')).rows[0].user_id, 30);
    assert.equal((await pool.query('SELECT order_id, product_id FROM order_items')).rows[0].order_id, 60);
    assert.equal(state.identityRestarts.get('categories'), 11);
    assert.equal(state.identityRestarts.get('users'), 31);
    await assert.rejects(importSqliteData(source, target), /already contains application data/);
    assert.equal((await pool.query('SELECT COUNT(*)::integer AS count FROM users')).rows[0].count, 1);
  });

  it('rolls back every inserted table when a source relationship is invalid', async () => {
    const source = createSource(true);
    const { target, state } = await createTarget();
    await assert.rejects(importSqliteData(source, target));
    assert.equal(state.rolledBack, true);
  });
});
