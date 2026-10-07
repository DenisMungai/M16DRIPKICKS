import crypto from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { config } from './config';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(key, expected);
}

export const COOKIE_NAME = 'nova_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd && config.appUrl.startsWith('https'),
  maxAge: MAX_AGE_MS,
  path: '/',
};

export const signSession = (userId: number) =>
  jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '30d' });

export function readSession(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.jwtSecret) as { sub?: number };
    return typeof p.sub === 'number' ? p.sub : null;
  } catch {
    return null;
  }
}

// Failed-login throttle: 5 failures per email+ip locks sign-in for 10 minutes.
const attempts = new Map<string, { n: number; until: number }>();
const LIMIT = 5;
const LOCK_MS = 10 * 60 * 1000;

export function loginLocked(key: string) {
  const a = attempts.get(key);
  if (!a) return false;
  if (a.until && a.until < Date.now()) { attempts.delete(key); return false; }
  return a.n >= LIMIT;
}
export function recordLoginFailure(key: string) {
  const a = attempts.get(key) ?? { n: 0, until: 0 };
  a.n += 1;
  if (a.n >= LIMIT) a.until = Date.now() + LOCK_MS;
  attempts.set(key, a);
}
export const clearLoginFailures = (key: string) => attempts.delete(key);
