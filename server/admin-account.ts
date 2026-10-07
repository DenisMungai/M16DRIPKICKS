import { hashPassword } from './auth';
import { db } from './db';

export async function syncAdminAccount(
  email: string,
  password: string,
  database: Pick<typeof db, 'transaction'> = db,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must both be set.');
  }

  const passwordHash = await hashPassword(password);
  const result = await database.transaction(async (client) => client.query<{ id: number }>(`
    INSERT INTO users (email, name, password_hash, role)
    VALUES ($1, 'Store Admin', $2, 'admin')
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, role = 'admin'
    RETURNING id`, [normalizedEmail, passwordHash]));

  return result.rows[0].id;
}
