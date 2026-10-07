import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  clearLoginFailures, COOKIE_NAME, cookieOptions, hashPassword, loginLocked,
  recordLoginFailure, signSession, verifyPassword,
} from '../auth.js';
import { db } from '../db.js';
import { userDto, type UserRow } from '../models.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(128);
const phone = z.string().trim().max(30).optional();

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => (ctx.user ? userDto(ctx.user) : null)),

  register: publicProcedure
    .input(z.object({ name: z.string().trim().min(2, 'Enter your name.').max(80), email, password, phone }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [input.email]);
      if (existing.rowCount) {
        throw new TRPCError({ code: 'CONFLICT', message: 'An account with this email already exists. Try signing in.' });
      }
      const hash = await hashPassword(input.password);
      const inserted = await db.query<{ id: number }>(
        'INSERT INTO users (email, name, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING id',
        [input.email, input.name, input.phone || null, hash],
      );
      const id = inserted.rows[0].id;
      await db.query("INSERT INTO user_coupons (user_id, coupon_id) SELECT $1::integer, id FROM coupons WHERE auto_grant = 1 AND active = 1", [id]);
      ctx.res.cookie(COOKIE_NAME, signSession(id), cookieOptions);
      const user = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
      return userDto(user.rows[0]);
    }),

  login: publicProcedure
    .input(z.object({ email, password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const key = `${input.email}|${ctx.req.ip}`;
      if (loginLocked(key)) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many failed attempts. Try again in 10 minutes.' });
      }
      const result = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [input.email]);
      const u = result.rows[0];
      const ok = u ? await verifyPassword(input.password, u.password_hash) : false;
      if (!u || !ok) {
        recordLoginFailure(key);
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email or password is incorrect.' });
      }
      clearLoginFailures(key);
      ctx.res.cookie(COOKIE_NAME, signSession(u.id), cookieOptions);
      return userDto(u);
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    return { ok: true };
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(80), email, phone, mpesaPhone: phone }))
    .mutation(async ({ input, ctx }) => {
      const clash = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [input.email, ctx.user.id]);
      if (clash.rowCount) throw new TRPCError({ code: 'CONFLICT', message: 'That email is used by another account.' });
      await db.query('UPDATE users SET name = $1, email = $2, phone = $3, mpesa_phone = $4 WHERE id = $5',
        [input.name, input.email, input.phone || null, input.mpesaPhone || null, ctx.user.id]);
      const user = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [ctx.user.id]);
      return userDto(user.rows[0]);
    }),

  changePassword: protectedProcedure
    .input(z.object({ current: z.string().min(1), next: password }))
    .mutation(async ({ input, ctx }) => {
      if (!(await verifyPassword(input.current, ctx.user.password_hash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Your current password is incorrect.' });
      }
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(input.next), ctx.user.id]);
      return { ok: true };
    }),
});
