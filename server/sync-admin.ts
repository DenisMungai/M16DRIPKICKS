import { config } from './config.js';
import { closeDatabase } from './db.js';
import { syncAdminAccount } from './admin-account.js';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set non-empty ADMIN_EMAIL and ADMIN_PASSWORD in the project-root .env.');
  }
  if (!config.databaseUrl) throw new Error('Set DATABASE_URL in the project-root .env.');

  await syncAdminAccount(email, password);
  console.log('[admin] Configured administrator account synchronized.');
}

main()
  .catch((error: unknown) => {
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[admin] Could not synchronize administrator credentials (${name}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
