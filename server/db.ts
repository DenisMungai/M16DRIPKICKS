import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { config } from './config.js';

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
    pool = new Pool({ connectionString: config.databaseUrl, max: 10, application_name: 'm16dripkicks-store' });
    pool.on('error', (error) => console.error('[database] PostgreSQL pool error:', error.message));
  }
  return pool;
}

export const db = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<Row>> {
    return getPool().query<Row>(text, [...values]);
  },
  async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const value = await run(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

const MIGRATIONS = ['001_initial.sql'];
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function initializeDatabase(transformMigrationSql: (sql: string) => string = (sql) => sql) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at text NOT NULL
  )`);

  for (const version of MIGRATIONS) {
    const applied = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (applied.rowCount) continue;
    const sql = transformMigrationSql(await fs.readFile(path.join(migrationsDir, version), 'utf8'));
    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version,applied_at) VALUES ($1,$2)', [version, nowIso()]);
    });
  }
}

export async function closeDatabase() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export function setPoolForTests(testPool: Pool) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test database pool injection is only available in test mode.');
  if (pool) throw new Error('The PostgreSQL pool was already initialized.');
  pool = testPool;
}

export const nowIso = () => new Date().toISOString();
