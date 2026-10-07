import { closeDatabase, initializeDatabase } from './db.js';

try {
  await initializeDatabase();
  console.log('[database] PostgreSQL schema is ready.');
} finally {
  await closeDatabase();
}
