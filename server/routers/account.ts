import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { db } from '../db.js';
import { PRODUCT_SELECT, productDto, toKes, type ProductRow } from '../models.js';
import { findCoupon } from '../services/pricing.js';
import { protectedProcedure, router } from '../trpc.js';

export const wishlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query<ProductRow>(
      `${PRODUCT_SELECT} JOIN wishlist w ON w.product_id = p.id WHERE w.user_id = $1 AND p.active = 1 ORDER BY w.created_at DESC`,
      [ctx.user.id],
    );
    return rows.rows.map(productDto);
  }),

  ids: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query<{ product_id: number }>('SELECT product_id FROM wishlist WHERE user_id = $1', [ctx.user.id]);
    return rows.rows.map((row) => row.product_id);
  }),

  toggle: protectedProcedure.input(z.object({ productId: z.number().int() })).mutation(async ({ input, ctx }) => {
    const removed = await db.query(
      'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2 RETURNING product_id',
      [ctx.user.id, input.productId],
    );
    if (removed.rowCount) return { saved: false };
    const product = await db.query('SELECT 1 FROM products WHERE id = $1 AND active = 1', [input.productId]);
    if (!product.rowCount) throw new TRPCError({ code: 'NOT_FOUND', message: 'This product could not be found.' });
    await db.query('INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ctx.user.id, input.productId]);
    return { saved: true };
  }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await db.query('DELETE FROM wishlist WHERE user_id = $1', [ctx.user.id]);
    return { ok: true };
  }),
});

type AddressRow = {
  id: number; user_id: number; label: string; name: string; phone: string; line1: string;
  line2: string | null; city: string; country: string; is_default: number;
};
const addressDto = (a: AddressRow) => ({
  id: a.id, label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2,
  city: a.city, country: a.country, isDefault: !!a.is_default,
});
const addressInput = z.object({
  label: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2, 'Enter the recipient name.').max(80),
  phone: z.string().trim().min(7, 'Enter a phone number.').max(30),
  line1: z.string().trim().min(3, 'Enter a street address.').max(120),
  line2: z.string().trim().max(120).nullish(),
  city: z.string().trim().min(2, 'Enter a city.').max(60),
  country: z.string().trim().min(2).max(60).default('Kenya'),
});

async function own(id: number, userId: number) {
  const result = await db.query<AddressRow>('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId]);
  const address = result.rows[0];
  if (!address) throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found.' });
  return address;
}

export const addressesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const result = await db.query<AddressRow>(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id',
      [ctx.user.id],
    );
    return result.rows.map(addressDto);
  }),

  create: protectedProcedure.input(addressInput).mutation(async ({ input, ctx }) => {
    const result = await db.query<{ id: number }>(`
      INSERT INTO addresses (user_id, label, name, phone, line1, line2, city, country, is_default)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN EXISTS (SELECT 1 FROM addresses WHERE user_id = $1) THEN 0 ELSE 1 END)
      RETURNING id`,
    [ctx.user.id, input.label, input.name, input.phone, input.line1, input.line2 ?? null, input.city, input.country]);
    return addressDto(await own(result.rows[0].id, ctx.user.id));
  }),

  update: protectedProcedure.input(addressInput.extend({ id: z.number().int() })).mutation(async ({ input, ctx }) => {
    await own(input.id, ctx.user.id);
    await db.query(
      'UPDATE addresses SET label=$1, name=$2, phone=$3, line1=$4, line2=$5, city=$6, country=$7 WHERE id=$8',
      [input.label, input.name, input.phone, input.line1, input.line2 ?? null, input.city, input.country, input.id],
    );
    return addressDto(await own(input.id, ctx.user.id));
  }),

  remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => {
    const address = await own(input.id, ctx.user.id);
    await db.transaction(async (client) => {
      await client.query('DELETE FROM addresses WHERE id = $1', [address.id]);
      if (address.is_default) {
        await client.query(
          'UPDATE addresses SET is_default = 1 WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY id LIMIT 1)',
          [ctx.user.id],
        );
      }
    });
    return { ok: true };
  }),

  setDefault: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => {
    await db.transaction(async (client) => {
      const address = await client.query('SELECT 1 FROM addresses WHERE id = $1 AND user_id = $2', [input.id, ctx.user.id]);
      if (!address.rowCount) throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found.' });
      await client.query('UPDATE addresses SET is_default = 0 WHERE user_id = $1', [ctx.user.id]);
      await client.query('UPDATE addresses SET is_default = 1 WHERE id = $1', [input.id]);
    });
    return { ok: true };
  }),
});

type CouponRow = NonNullable<Awaited<ReturnType<typeof findCoupon>>>;

export const couponsRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const result = await db.query<CouponRow>(`
      SELECT c.* FROM coupons c JOIN user_coupons uc ON uc.coupon_id = c.id
      WHERE uc.user_id = $1 ORDER BY c.id`, [ctx.user.id]);
    return result.rows.map((coupon) => {
      const expired = !coupon.active || (!!coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now());
      return {
        code: coupon.code, tag: expired ? 'Expired' : coupon.tag, title: coupon.title, note: coupon.note, type: coupon.type,
        minSpend: toKes(coupon.min_spend_cents), expiresAt: coupon.expires_at, expired,
      };
    });
  }),

  claim: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(40) })).mutation(async ({ input, ctx }) => {
    const coupon = await findCoupon(input.code);
    if (!coupon || !coupon.active) throw new TRPCError({ code: 'NOT_FOUND', message: 'That code is not valid.' });
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That code has expired.' });
    }
    await db.query('INSERT INTO user_coupons (user_id, coupon_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [ctx.user.id, coupon.id]);
    return { code: coupon.code, title: coupon.title };
  }),
});
