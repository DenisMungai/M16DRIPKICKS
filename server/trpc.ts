import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  // Turn zod issues into one readable message plus a field -> message map the forms can use.
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of error.cause.issues) fieldErrors[i.path.join('.')] ??= i.message;
      return { ...shape, message: error.cause.issues[0]?.message ?? 'Check the form and try again.', data: { ...shape.data, fieldErrors } };
    }
    return { ...shape, data: { ...shape.data, fieldErrors: null } };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access only.' });
  return next();
});
