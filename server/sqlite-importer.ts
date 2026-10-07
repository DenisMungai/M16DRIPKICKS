import type Database from 'better-sqlite3';
import type { PoolClient } from 'pg';
import { db } from './db.js';

export const SQLITE_IMPORT_TABLES = {
  categories: ['id', 'name', 'slug'],
  brands: ['id', 'name', 'blurb', 'cta'],
  users: ['id', 'email', 'name', 'phone', 'mpesa_phone', 'password_hash', 'role', 'created_at'],
  products: [
    'id', 'sku', 'name', 'sub', 'description', 'category_id', 'brand_id', 'price_cents', 'was_cents',
    'badge', 'is_new', 'rating', 'review_count', 'stock', 'sold', 'image', 'sizes', 'colors', 'active', 'created_at',
  ],
  coupons: ['id', 'code', 'tag', 'title', 'note', 'type', 'value', 'min_spend_cents', 'expires_at', 'one_per_user', 'auto_grant', 'active'],
  orders: [
    'id', 'code', 'user_id', 'status', 'payment_method', 'payment_status', 'payment_ref', 'mpesa_receipt',
    'subtotal_cents', 'discount_cents', 'shipping_cents', 'total_cents', 'coupon_code', 'shipping_method',
    'email', 'ship_name', 'ship_phone', 'ship_line', 'ship_city', 'ship_country', 'tracking', 'note', 'created_at', 'updated_at',
  ],
  order_items: ['id', 'order_id', 'product_id', 'name', 'sku', 'price_cents', 'qty', 'size', 'color'],
  wishlist: ['user_id', 'product_id', 'created_at'],
  user_coupons: ['user_id', 'coupon_id'],
  addresses: ['id', 'user_id', 'label', 'name', 'phone', 'line1', 'line2', 'city', 'country', 'is_default'],
} as const;

type TableName = keyof typeof SQLITE_IMPORT_TABLES;
type SqliteRow = Record<string, unknown>;

async function destinationCounts(client: PoolClient) {
  const counts = {} as Record<TableName, number>;
  for (const table of Object.keys(SQLITE_IMPORT_TABLES) as TableName[]) {
    const result = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
    counts[table] = Number(result.rows[0].count);
  }
  return counts;
}

const IDENTITY_TABLES = ['users', 'categories', 'brands', 'products', 'coupons', 'orders', 'order_items', 'addresses'] as const;

async function resetIdentity(client: PoolClient, table: typeof IDENTITY_TABLES[number]) {
  const maximum = await client.query<{ max_id: number | null }>(`SELECT MAX(id) AS max_id FROM ${table}`);
  const maxId = maximum.rows[0].max_id;
  const nextId = maxId === null ? 1 : maxId + 1;
  if (!Number.isSafeInteger(nextId)) throw new Error(`Could not reset the ${table} identity sequence safely.`);
  await client.query(`ALTER TABLE ${table} ALTER COLUMN id RESTART WITH ${nextId}`);
}

export async function importSqliteData(source: Database.Database, target: Pick<typeof db, 'transaction'> = db) {
  for (const [table, columns] of Object.entries(SQLITE_IMPORT_TABLES) as [TableName, readonly string[]][]) {
    const sourceColumns = new Set(
      (source.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(({ name }) => name),
    );
    if (!sourceColumns.size) throw new Error(`Legacy SQLite database is missing the ${table} table.`);
    const missing = columns.filter((column) => !sourceColumns.has(column));
    if (missing.length) throw new Error(`Legacy SQLite table ${table} is missing required columns.`);
  }

  const sourceRows = {} as Record<TableName, SqliteRow[]>;
  const counts = {} as Record<TableName, number>;
  for (const table of Object.keys(SQLITE_IMPORT_TABLES) as TableName[]) {
    sourceRows[table] = source.prepare(`SELECT * FROM "${table}"`).all() as SqliteRow[];
    counts[table] = sourceRows[table].length;
  }
  if (!Object.values(counts).some((count) => count > 0)) {
    throw new Error('Legacy SQLite database contains no application data.');
  }

  await target.transaction(async (client) => {
    const existing = await destinationCounts(client);
    if (Object.values(existing).some((count) => count > 0)) {
      throw new Error('PostgreSQL destination already contains application data; refusing to import.');
    }

    for (const table of Object.keys(SQLITE_IMPORT_TABLES) as TableName[]) {
      const columns = SQLITE_IMPORT_TABLES[table];
      const columnList = columns.join(', ');
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const insert = `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`;
      for (const row of sourceRows[table]) {
        await client.query(insert, columns.map((column) => row[column]));
      }
    }

    for (const table of IDENTITY_TABLES) {
      await resetIdentity(client, table);
    }
  });

  return counts;
}
