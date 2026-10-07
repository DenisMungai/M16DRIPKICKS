import { addressesRouter, couponsRouter, wishlistRouter } from './routers/account.js';
import { adminRouter } from './routers/admin.js';
import { authRouter } from './routers/auth.js';
import { catalogRouter, checkoutRouter, metaRouter } from './routers/catalog.js';
import { ordersRouter } from './routers/orders.js';
import { router } from './trpc.js';

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
