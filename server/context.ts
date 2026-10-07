import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { COOKIE_NAME, readSession } from './auth';
import { db } from './db';
import type { UserRow } from './models';

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const id = readSession(req.cookies?.[COOKIE_NAME]);
  const result = id ? await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]) : null;
  const user = result?.rows[0] ?? null;
  return { req, res, user };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
