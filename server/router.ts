import { addressesRouter, couponsRouter, wishlistRouter } from './routers/account';
import { adminRouter } from './routers/admin';
import { authRouter } from './routers/auth';
import { catalogRouter, checkoutRouter, metaRouter } from './routers/catalog';
import { ordersRouter } from './routers/orders';
import { router } from './trpc';

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  checkout: checkoutRouter,
  meta: metaRouter,
  wishlist: wishlistRouter,
  addresses: addressesRouter,
  coupons: couponsRouter,
  orders: ordersRouter,
  admin: adminRouter,
});
export type AppRouter = typeof appRouter;
