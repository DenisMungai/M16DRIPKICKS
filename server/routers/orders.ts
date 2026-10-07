import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { db } from '../db';
import { orderDto, type OrderRow } from '../models';
import { createOrder } from '../services/orders';
import { refreshPayment } from '../services/payments';
import { cancelOrder, getOrder } from '../services/settlement';
import { protectedProcedure, router } from '../trpc';

export const ordersRouter = router({
  create: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.number().int(), qty: z.number().int().min(1).max(10),
        size: z.string().nullish(), color: z.string().nullish(),
      })).min(1).max(50),
      couponCode: z.string().max(40).nullish(),
      shippingMethod: z.enum(['standard', 'express']),
      paymentMethod: z.enum(['card', 'mpesa', 'cod']),
      mpesaPhone: z.string().max(30).optional(),
      address: z.object({
        name: z.string().trim().min(2, 'Enter the recipient name.').max(80),
        phone: z.string().trim().min(7, 'Enter a phone number for delivery updates.').max(30),
        line1: z.string().trim().min(3, 'Enter a street address.').max(120),
        line2: z.string().trim().max(120).nullish(),
        city: z.string().trim().min(2, 'Enter a city.').max(60),
        country: z.string().trim().min(2).max(60).default('Kenya'),
      }),
      saveAddress: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => createOrder(ctx.user, input)),

  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).default({}))
    .query(async ({ input, ctx }) => {
      const rows = await db.query<OrderRow>('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [ctx.user.id, input.limit]);
      return Promise.all(rows.rows.map(orderDto));
    }),

  byCode: protectedProcedure.input(z.object({ code: z.string().min(4).max(30) })).query(async ({ input, ctx }) => {
    let order = await getOrder(input.code);
    if (!order || (order.user_id !== ctx.user.id && ctx.user.role !== 'admin')) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
    }
    await refreshPayment(order);
    order = await getOrder(input.code) as OrderRow;
    return orderDto(order);
  }),

  cancel: protectedProcedure.input(z.object({ code: z.string() })).mutation(async ({ input, ctx }) => {
    const o = await getOrder(input.code);
    if (!o || o.user_id !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
    if (o.payment_status === 'paid') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Paid orders are cancelled by our support team so we can refund you. Contact support.' });
    }
    if (!await cancelOrder(o.code, 'Cancelled by customer.')) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This order can no longer be cancelled.' });
    }
    return { ok: true };
  }),
});
