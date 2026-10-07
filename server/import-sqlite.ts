import Database from 'better-sqlite3';
import { config } from './config';
import { closeDatabase, initializeDatabase } from './db';
import { importSqliteData } from './sqlite-importer';

async function main() {
  try {
    await initializeDatabase();
    const source = new Database(config.legacyDbPath, { readonly: true, fileMustExist: true });
    try {
      const counts = await importSqliteData(source);
      console.log('[sqlite import] Complete. Imported row counts:', counts);
    } finally {
      source.close();
    }
  } finally {
    await closeDatabase();
  }
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  console.error(`[sqlite import] Failed (${name}); PostgreSQL changes were rolled back. Check database setup and source schema.`);
  process.exitCode = 1;
});
