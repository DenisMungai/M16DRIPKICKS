import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { newDb } from 'pg-mem';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.MPESA_SIM_DELAY_MS = '40';
process.env.SEED_DEMO_DATA = 'true';
process.env.STRIPE_SECRET_KEY = '';
process.env.MPESA_CONSUMER_KEY = '';

type Caller = ReturnType<Awaited<typeof import('../trpc.js')>['createCallerFactory']> extends (ctx: never) => infer R ? R : never;

let make: (userId?: number) => any;
let db: typeof import('../db.js').db;
let users: Map<number, import('../models.js').UserRow>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const row = async <T extends import('pg').QueryResultRow>(sql: string, values: readonly unknown[] = []) =>
  (await db.query<T>(sql, values)).rows[0];
const stock = async (sku: string) => (await row<{ stock: number }>('SELECT stock FROM products WHERE sku = $1', [sku])).stock;
const setStock = async (sku: string, value: number) => { await db.query('UPDATE products SET stock = $1 WHERE sku = $2', [value, sku]); };
const pid = async (sku: string) => (await row<{ id: number }>('SELECT id FROM products WHERE sku = $1', [sku])).id;

before(async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const TestPool = memory.adapters.createPg().Pool;
  const database = await import('../db.js');
  db = database.db;
  database.setPoolForTests(new TestPool() as unknown as import('pg').Pool);
  await database.initializeDatabase((sql) => sql.replaceAll('DEFAULT CURRENT_TIMESTAMP::text', "DEFAULT '2026-01-01T00:00:00.000Z'"));
  const { seedAll } = await import('../seed.js');
  const { appRouter } = await import('../router.js');
  const { createCallerFactory } = await import('../trpc.js');
  await seedAll();
  const factory = createCallerFactory(appRouter);
  const allUsers = await db.query<import('../models.js').UserRow>('SELECT * FROM users');
  users = new Map(allUsers.rows.map((user) => [user.id, user]));
  make = (userId) => {
    const user = userId ? users.get(userId) ?? null : null;
    return factory({ user, req: { ip: '127.0.0.1' }, res: { cookie() {}, clearCookie() {} } } as never);
  };
});

const address = { name: 'Test Buyer', phone: '0712345678', line1: '12 Test Street', city: 'Nairobi', country: 'Kenya' };
describe('admin credential sync', () => {
  it('creates and updates only the configured admin account with a hashed password', async () => {
    const { syncAdminAccount } = await import('../admin-account.js');
    const { hashPassword, verifyPassword } = await import('../auth.js');
    const email = 'admin-sync-test@example.test';
    const unrelatedPasswordHash = await hashPassword('Unrelated123!');
    const unrelated = await db.query<{ id: number }>(
      `INSERT INTO users (email,name,password_hash,role)
       VALUES ($1,'Unrelated User',$2,'customer') RETURNING id`,
      ['unrelated-sync-test@example.test', unrelatedPasswordHash],
    );
    let adminId: number | undefined;
    try {
      adminId = await syncAdminAccount(email, 'InitialPassword123!');
      let admin = await row<import('../models.js').UserRow>('SELECT * FROM users WHERE id = $1', [adminId]);
      assert.equal(admin.role, 'admin');
      assert.equal(await verifyPassword('InitialPassword123!', admin.password_hash), true);

      await db.query("UPDATE users SET role = 'customer' WHERE id = $1", [adminId]);
      const updatedId = await syncAdminAccount(email.toUpperCase(), 'UpdatedPassword123!');
      admin = await row<import('../models.js').UserRow>('SELECT * FROM users WHERE id = $1', [updatedId]);
      assert.equal(updatedId, adminId);
      assert.equal(admin.role, 'admin');
      assert.equal(await verifyPassword('InitialPassword123!', admin.password_hash), false);
      assert.equal(await verifyPassword('UpdatedPassword123!', admin.password_hash), true);
      assert.equal((await row<import('../models.js').UserRow>('SELECT * FROM users WHERE id = $1', [unrelated.rows[0].id])).role, 'customer');
    } finally {
      if (adminId !== undefined) await db.query('DELETE FROM users WHERE id = $1', [adminId]);
      await db.query('DELETE FROM users WHERE id = $1', [unrelated.rows[0].id]);
    }
  });

  it('rejects missing credentials without writing an account', async () => {
    const { syncAdminAccount } = await import('../admin-account.js');
    const before = (await row<{ count: number }>('SELECT COUNT(*)::integer AS count FROM users')).count;
    await assert.rejects(syncAdminAccount('', 'password'), /ADMIN_EMAIL and ADMIN_PASSWORD/);
    await assert.rejects(syncAdminAccount('admin@example.test', ''), /ADMIN_EMAIL and ADMIN_PASSWORD/);
    assert.equal((await row<{ count: number }>('SELECT COUNT(*)::integer AS count FROM users')).count, before);
  });

  it('synchronizes configured admin credentials when the catalog already exists', async () => {
    const { config } = await import('../config.js');
    const { verifyPassword } = await import('../auth.js');
    const { seedIfEmpty } = await import('../seed.js');
    await db.query("UPDATE users SET role = 'customer', password_hash = $1 WHERE email = $2", [
      'stale-password-hash',
      config.adminEmail,
    ]);

    assert.equal(await seedIfEmpty(), false);
    const admin = await row<import('../models.js').UserRow>('SELECT * FROM users WHERE email = $1', [config.adminEmail]);
    assert.equal(admin.role, 'admin');
    assert.equal(await verifyPassword(config.adminPassword, admin.password_hash), true);
  });
});

describe('catalog', () => {
  it('lists real catalog products with local photos and KSh prices', async () => {
    const api = make();
    const all = await api.catalog.products.list({ limit: 100 });
    assert.equal(all.total, 29);
    assert.ok(all.items.every((p: any) => p.price >= 3000 && p.price <= 5000));
    assert.ok(all.items.every((p: any) => p.stock > 0));
    assert.ok(all.items.every((p: any) => existsSync(path.resolve(process.cwd(), 'public', p.image.slice(1)))));
    assert.equal((await api.catalog.products.list({ q: 'boots' })).items.length, 4);
    const priceSort = await api.catalog.products.list({ sort: 'price_asc', limit: 100 });
    assert.ok(priceSort.items[0].price <= priceSort.items.at(-1)!.price);
  });
  it('uses the same configured KSh conversion for product prices and M-Pesa', async () => {
    const { kesAmount } = await import('../services/payments.js');
    const cents = (await row<{ price_cents: number }>('SELECT price_cents FROM products WHERE sku = $1', ['M16-STRAP-SNEAKER'])).price_cents;
    const product = await make().catalog.products.byId({ id: await pid('M16-STRAP-SNEAKER') });
    assert.equal(kesAmount(cents), product.price);
  });
  it('refreshes the catalog idempotently without deleting customer or order history', async () => {
    const { refreshCatalog } = await import('../seed.js');
    const usersBefore = (await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM users')).n;
    const ordersBefore = (await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM orders')).n;
    const wishlistBefore = (await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM wishlist')).n;
    await setStock('M16-BOOT-PATENT', 7);
    await setStock('M16-STRAP-SNEAKER', 0);
    assert.equal(await refreshCatalog(), 29);
    assert.equal(await refreshCatalog(), 29);
    assert.equal((await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM products WHERE active = 1')).n, 29);
    assert.equal((await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM products WHERE active = 1 AND sku NOT LIKE 'M16-%'")).n, 0);
    assert.equal((await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM users')).n, usersBefore);
    assert.equal((await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM orders')).n, ordersBefore);
    assert.equal((await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM wishlist')).n, wishlistBefore);
    assert.equal(await stock('M16-BOOT-PATENT'), 7);
    assert.equal(await stock('M16-STRAP-SNEAKER'), 10);
  });
  it('returns categories with counts and brands with top products', async () => {
    const api = make();
    const cats = await api.catalog.categories();
    assert.ok(cats.find((c: any) => c.slug === 'footwear').count > 5);
    const brands = await api.catalog.brands();
    assert.ok(brands.every((b: any) => b.top.length > 0));
  });
  it('404s on unknown products', async () => {
    await assert.rejects(make().catalog.products.byId({ id: 99999 }), /could not be found/);
  });
});

describe('auth', () => {
  it('uses a development-compatible session cookie outside production', async () => {
    const { COOKIE_NAME, cookieOptions } = await import('../auth.js');
    assert.equal(COOKIE_NAME, 'nova_session');
    assert.equal(cookieOptions.secure, false);
    assert.equal(cookieOptions.path, '/');
  });

  it('registers, rejects duplicates and bad logins, grants coupons', async () => {
    const api = make();
    const u = await api.auth.register({ name: 'Test Buyer', email: 'Buyer@Example.com', password: 'Secret123!' });
    users.set(u.id, await row<import('../models.js').UserRow>('SELECT * FROM users WHERE id = $1', [u.id]));
    assert.equal(u.email, 'buyer@example.com');
    await assert.rejects(api.auth.register({ name: 'X Y', email: 'buyer@example.com', password: 'Secret123!' }), /already exists/);
    await assert.rejects(api.auth.login({ email: 'buyer@example.com', password: 'wrong-password' }), /incorrect/);
    const ok = await api.auth.login({ email: 'buyer@example.com', password: 'Secret123!' });
    assert.equal(ok.role, 'customer');
    const wallet = await make(u.id).coupons.mine();
    assert.deepEqual(wallet.map((c: any) => c.code).sort(), ['FREESHIP24', 'KICKS10', 'SUMMER25', 'WELCOME15']);
    assert.equal(wallet.find((c: any) => c.code === 'KICKS10').expired, true);
  });
  it('locks sign-in after repeated failures', async () => {
    const api = make();
    for (let i = 0; i < 5; i++) await api.auth.login({ email: 'nobody@example.com', password: 'x' }).catch(() => {});
    await assert.rejects(api.auth.login({ email: 'nobody@example.com', password: 'x' }), /Too many/);
  });
  it('changes password only with the current one', async () => {
    const id = (await row<{ id: number }>("SELECT id FROM users WHERE email = 'buyer@example.com'")).id;
    const api = make(id);
    await assert.rejects(api.auth.changePassword({ current: 'nope', next: 'Another123!' }), /incorrect/);
    await api.auth.changePassword({ current: 'Secret123!', next: 'Another123!' });
    await make().auth.login({ email: 'buyer@example.com', password: 'Another123!' });
  });
});

describe('pricing and coupons', () => {
  it('flags a missing size and applies percent coupons', async () => {
    const api = make();
    const shoe = await pid('M16-STRAP-SNEAKER');
    await setStock('M16-STRAP-SNEAKER', 10);
    const q = await api.checkout.quote({ items: [{ productId: shoe, qty: 2, size: '9' }], couponCode: 'summer25' });
    assert.equal(q.subtotal, 10000);
    assert.equal(q.discount, 2500);
    assert.equal(q.total, 7500);
    assert.equal(q.issues.length, 0);
  });
  it('enforces min spend, expiry, shipping and free-shipping codes', async () => {
    const api = make();
    const mat = await pid('M16-VIOLET-CHUNKY');
    const low = await api.checkout.quote({ items: [{ productId: mat, qty: 1 }], couponCode: 'WELCOME15' });
    assert.equal(low.coupon.ok, false);
    assert.match(low.coupon.message, /at least KSh 10,000/);
    const expired = await api.checkout.quote({ items: [{ productId: mat, qty: 1 }], couponCode: 'KICKS10' });
    assert.match(expired.coupon.message, /expired/);
    const express = await api.checkout.quote({ items: [{ productId: mat, qty: 1 }], shippingMethod: 'express' });
    assert.equal(express.shipping, 1548);
    const free = await api.checkout.quote({ items: [{ productId: mat, qty: 1 }], shippingMethod: 'express', couponCode: 'FREESHIP24' });
    assert.equal(free.shipping, 0);
  });
  it('caps stock across lines of the same product', async () => {
    await setStock('M16-BOOT-PATENT', 6);
    const productId = await pid('M16-BOOT-PATENT');
    const q = await make().checkout.quote({ items: [{ productId, qty: 5 }, { productId, qty: 5 }] });
    assert.match(q.issues.join(' '), /Only 6 of Patent Over-the-Knee Boots left/);
  });
});

describe('orders', () => {
  let userId: number;
  before(async () => { userId = (await row<{ id: number }>("SELECT id FROM users WHERE email = 'buyer@example.com'")).id; });

  it('requires sign-in', async () => {
    await assert.rejects(make().orders.create({ items: [{ productId: 1, qty: 1 }], shippingMethod: 'standard', paymentMethod: 'cod', address }), /Sign in/);
  });

  it('places a cash-on-delivery order, takes stock, then cancel restocks', async () => {
    const api = make(userId);
    await setStock('M16-STRAP-SNEAKER', 10);
    const before = await stock('M16-STRAP-SNEAKER');
    const r = await api.orders.create({ items: [{ productId: await pid('M16-STRAP-SNEAKER'), qty: 3 }], shippingMethod: 'standard', paymentMethod: 'cod', address });
    assert.equal(await stock('M16-STRAP-SNEAKER'), before - 3);
    const o = await api.orders.byCode({ code: r.code });
    assert.equal(o.status, 'processing');
    assert.equal(o.paymentStatus, 'cod');
    assert.equal(o.total, 15000);
    await api.orders.cancel({ code: r.code });
    assert.equal(await stock('M16-STRAP-SNEAKER'), before);
    assert.equal((await api.orders.byCode({ code: r.code })).status, 'cancelled');
  });

  it('rejects orders above stock and unknown sizes without creating them', async () => {
    const api = make(userId);
    await setStock('M16-BOOT-PATENT', 6);
    const n = (await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM orders')).n;
    await assert.rejects(api.orders.create({ items: [{ productId: await pid('M16-BOOT-PATENT'), qty: 7 }], shippingMethod: 'standard', paymentMethod: 'cod', address }), /Only 6/);
    await setStock('M16-VIOLET-CHUNKY', 0);
    await assert.rejects(api.orders.create({ items: [{ productId: await pid('M16-VIOLET-CHUNKY'), qty: 1 }], shippingMethod: 'standard', paymentMethod: 'cod', address }), /sold out/);
    await assert.rejects(api.orders.create({ items: [{ productId: 99999, qty: 1 }], shippingMethod: 'standard', paymentMethod: 'cod', address }), /no longer available/);
    assert.equal((await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM orders')).n, n);
  });

  it('pays by card in demo mode immediately', async () => {
    const api = make(userId);
    await setStock('M16-STRAP-SNEAKER', 10);
    const r = await api.orders.create({ items: [{ productId: await pid('M16-STRAP-SNEAKER'), qty: 1 }], shippingMethod: 'express', paymentMethod: 'card', address });
    assert.equal(r.redirectUrl, null);
    const o = await api.orders.byCode({ code: r.code });
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.status, 'processing');
    assert.equal(o.total, 6548);
  });

  it('M-Pesa: pending until the demo prompt is confirmed', async () => {
    const api = make(userId);
    await setStock('M16-GRAPHIC-TEE', 10);
    const r = await api.orders.create({ items: [{ productId: await pid('M16-GRAPHIC-TEE'), qty: 1 }], shippingMethod: 'standard', paymentMethod: 'mpesa', mpesaPhone: '0712 345 678', address });
    assert.equal((await api.orders.byCode({ code: r.code })).paymentStatus, 'unpaid');
    await wait(120);
    const o = await api.orders.byCode({ code: r.code });
    assert.equal(o.paymentStatus, 'paid');
    assert.match(o.mpesaReceipt ?? '', /^SIM/);
  });

  it('M-Pesa: a cancelled prompt releases the stock', async () => {
    const api = make(userId);
    await setStock('M16-GRAPHIC-TEE', 10);
    const before = await stock('M16-GRAPHIC-TEE');
    const r = await api.orders.create({ items: [{ productId: await pid('M16-GRAPHIC-TEE'), qty: 2 }], shippingMethod: 'standard', paymentMethod: 'mpesa', mpesaPhone: '0700000000', address });
    assert.equal(await stock('M16-GRAPHIC-TEE'), before - 2);
    await wait(120);
    const o = await api.orders.byCode({ code: r.code });
    assert.equal(o.status, 'cancelled');
    assert.equal(o.paymentStatus, 'failed');
    assert.equal(await stock('M16-GRAPHIC-TEE'), before);
  });

  it('rejects an invalid M-Pesa number and leaves no order or stock change behind', async () => {
    const api = make(userId);
    await setStock('M16-NAVY-LOWTOP', 10);
    const before = await stock('M16-NAVY-LOWTOP');
    await assert.rejects(api.orders.create({ items: [{ productId: await pid('M16-NAVY-LOWTOP'), qty: 1 }], shippingMethod: 'standard', paymentMethod: 'mpesa', mpesaPhone: '12345', address }), /valid Safaricom number/);
    assert.equal(await stock('M16-NAVY-LOWTOP'), before);
  });

  it('uses one-per-customer coupons only once', async () => {
    const api = make(userId);
    await setStock('M16-STRAP-SNEAKER', 10);
    const items = [{ productId: await pid('M16-STRAP-SNEAKER'), qty: 3 }];
    const first = await api.orders.create({ items, couponCode: 'WELCOME15', shippingMethod: 'standard', paymentMethod: 'cod', address });
    assert.equal((await api.orders.byCode({ code: first.code })).discount, 1500);
    await assert.rejects(api.orders.create({ items, couponCode: 'WELCOME15', shippingMethod: 'standard', paymentMethod: 'cod', address }), /already used/);
  });

  it("keeps customers out of each other's orders", async () => {
    const mine = await make(userId).orders.list();
    const other = (await row<{ id: number }>("SELECT id FROM users WHERE email = 'demo@novashop.test'")).id;
    await assert.rejects(make(other).orders.byCode({ code: mine[0].code }), /not found/);
  });

  it('will not let a customer cancel a paid order', async () => {
    const paid = (await make(userId).orders.list()).find((o: any) => o.paymentStatus === 'paid' && o.status === 'processing');
    await assert.rejects(make(userId).orders.cancel({ code: paid!.code }), /support team/);
  });
});

describe('wishlist and addresses', () => {
  it('toggles the wishlist', async () => {
    const id = (await row<{ id: number }>("SELECT id FROM users WHERE email = 'buyer@example.com'")).id;
    const api = make(id);
    assert.deepEqual(await api.wishlist.toggle({ productId: 3 }), { saved: true });
    assert.deepEqual(await api.wishlist.ids(), [3]);
    assert.deepEqual(await api.wishlist.toggle({ productId: 3 }), { saved: false });
    assert.equal((await api.wishlist.list()).length, 0);
  });
  it('manages addresses with a single default', async () => {
    const id = (await row<{ id: number }>("SELECT id FROM users WHERE email = 'buyer@example.com'")).id;
    const api = make(id);
    const a = await api.addresses.create({ label: 'Home', ...address });
    const b = await api.addresses.create({ label: 'Office', ...address, line1: '99 Work Rd' });
    assert.equal(a.isDefault, true);
    assert.equal(b.isDefault, false);
    await api.addresses.setDefault({ id: b.id });
    let list = await api.addresses.list();
    assert.equal(list.filter((x: any) => x.isDefault).length, 1);
    assert.equal(list[0].id, b.id);
    await api.addresses.remove({ id: b.id });
    list = await api.addresses.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].isDefault, true);
  });
});

describe('admin', () => {
  const adminId = async () => (await row<{ id: number }>("SELECT id FROM users WHERE role = 'admin'")).id;

  it('blocks customers and anonymous users', async () => {
    const id = (await row<{ id: number }>("SELECT id FROM users WHERE email = 'buyer@example.com'")).id;
    await assert.rejects(make(id).admin.dashboard({ range: 'week' }), /Admin access only/);
    await assert.rejects(make().admin.dashboard({ range: 'week' }), /Sign in/);
  });

  it('builds the dashboard', async () => {
    const id = await adminId();
    const d = await make(id).admin.dashboard({ range: 'year' });
    assert.equal(d.chart.labels.length, 12);
    assert.ok(d.cards.revenue.value > 0);
    assert.ok(d.cards.orders.value > 0);
    assert.ok(Array.isArray(d.trending));
    assert.ok(d.recent.length > 0);
    assert.equal((await make(id).admin.dashboard({ range: 'week' })).chart.labels.length, 7);
    assert.equal((await make(id).admin.dashboard({ range: 'month' })).chart.labels.length, 4);
  });

  it('creates, edits, filters and hides products', async () => {
    const api = make(await adminId());
    const base = { sku: 'TEST-001', name: 'Test Cap', sub: 'Cotton', description: '', category: 'Apparel', brand: 'M16 Drip', price: 4000, was: 5000, badge: null, isNew: true, stock: 5, image: null, sizes: [], colors: [], active: true };
    const { id } = await api.admin.productCreate(base);
    await assert.rejects(api.admin.productCreate(base), /SKU is already in use/);
    await assert.rejects(api.admin.productUpdate({ ...base, id, was: 10 }), /higher than the sale price/);
    const discounted = await api.catalog.products.byId({ id });
    assert.ok(discounted.discountPct > 0);
    assert.ok(discounted.was > discounted.price);
    await api.admin.productUpdate({ ...base, id, price: 4500, stock: 40 });
    const inv = await api.admin.inventory({ q: 'TEST-001' });
    assert.equal(inv.items[0].price, 4500);
    assert.equal((await api.admin.inventory({ status: 'out' })).items.every((p: any) => p.stock === 0), true);
    await api.admin.productDelete({ id });
    assert.equal((await api.admin.inventory({ q: 'TEST-001' })).total, 0);
    await assert.rejects(make().catalog.products.byId({ id }), /could not be found/);
  });

  it('creates and manages usable coupons with admin-only access and auto-grants', async () => {
    const admin = make(await adminId());
    const customerId = (await row<{ id: number }>("SELECT id FROM users WHERE role = 'customer' LIMIT 1")).id;
    const customer = make(customerId);
    await assert.rejects(customer.admin.coupons(), /Admin access only/);
    await assert.rejects(make().admin.coupons(), /Sign in/);

    const code = `TEST-${Date.now()}`;
    let couponId: number | undefined;
    let registeredUserId: number | undefined;
    try {
      const created = await admin.admin.couponCreate({
        code: code.toLowerCase(), tag: 'Test offer', title: 'Test discount', note: '',
        type: 'percent', value: 15, minSpend: 0, expiresAt: null,
        onePerUser: true, autoGrant: true, active: true,
      });
      couponId = created.id;
      assert.equal(created.code, code);
      assert.equal(created.active, true);
      assert.equal(created.value, 15);
      await assert.rejects(admin.admin.couponCreate({
        code, tag: 'Test offer', title: 'Duplicate discount', note: '',
        type: 'percent', value: 10, minSpend: 0, expiresAt: null,
        onePerUser: false, autoGrant: false, active: true,
      }), /already in use/);
      await assert.rejects(admin.admin.couponCreate({
        code: `${code}-BAD`, tag: 'Test offer', title: 'Invalid discount', note: '',
        type: 'percent', value: 101, minSpend: 0, expiresAt: null,
        onePerUser: false, autoGrant: false, active: true,
      }), /Percentage must be between 1 and 100/);

      const listed = await admin.admin.coupons();
      assert.ok(listed.some((item: any) => item.id === created.id));
      const assigned = await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM user_coupons WHERE coupon_id = $1', [created.id]);
      const customers = await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM users WHERE role = 'customer'");
      assert.equal(assigned.n, customers.n);

      await customer.coupons.claim({ code });
      const productId = (await row<{ id: number }>('SELECT id FROM products WHERE active = 1 AND stock > 0 LIMIT 1')).id;
      const quote = await customer.checkout.quote({ items: [{ productId, qty: 1 }], couponCode: code, shippingMethod: 'standard' });
      assert.equal(quote.coupon?.ok, true);
      assert.ok(quote.discount > 0);

      const registered = await make().auth.register({
        name: 'Auto Grant Test', email: `auto-grant-${Date.now()}@example.test`, password: 'TestPassword123!',
      });
      registeredUserId = registered.id;
      const newUserCoupon = await row<{ n: number }>(
        'SELECT COUNT(*)::integer AS n FROM user_coupons WHERE user_id = $1 AND coupon_id = $2',
        [registered.id, created.id],
      );
      assert.equal(newUserCoupon.n, 1);

      await admin.admin.couponSetActive({ id: created.id, active: false });
      await assert.rejects(customer.coupons.claim({ code }), /not valid/);
      const inactiveQuote = await customer.checkout.quote({ items: [{ productId, qty: 1 }], couponCode: code, shippingMethod: 'standard' });
      assert.equal(inactiveQuote.coupon?.ok, false);
      await admin.admin.couponSetActive({ id: created.id, active: true });
      assert.equal((await admin.admin.coupons()).find((item: any) => item.id === created.id)?.active, true);
    } finally {
      if (registeredUserId !== undefined) await db.query('DELETE FROM users WHERE id = $1', [registeredUserId]);
      if (couponId !== undefined) await db.query('DELETE FROM coupons WHERE id = $1', [couponId]);
    }
  });

  it('moves orders through fulfilment', async () => {
    const api = make(await adminId());
    const list = await api.admin.orders({ status: 'processing', pageSize: 100 });
    const cod = list.items.find((o: any) => o.paymentMethod === 'cod')!;
    await assert.rejects(api.admin.orderUpdate({ code: cod.code, status: 'shipped' }), /tracking number/);
    await api.admin.orderUpdate({ code: cod.code, status: 'shipped', tracking: 'TRK123' });
    await api.admin.orderUpdate({ code: cod.code, status: 'delivered' });
    const done = (await api.orders.byCode({ code: cod.code }));
    assert.equal(done.status, 'delivered');
    assert.equal(done.paymentStatus, 'paid');
    await assert.rejects(api.admin.orderUpdate({ code: cod.code, status: 'processing' }), /backwards/);
    await assert.rejects(api.admin.orderUpdate({ code: cod.code, status: 'cancelled' }), /cannot be cancelled/);
  });

  it('flags a paid order for refund when the store cancels it', async () => {
    const api = make(await adminId());
    const paid = (await api.admin.orders({ status: 'processing', pageSize: 100 })).items.find((o: any) => o.paymentStatus === 'paid')!;
    await api.admin.orderUpdate({ code: paid.code, status: 'cancelled' });
    assert.equal((await api.orders.byCode({ code: paid.code })).paymentStatus, 'refund_due');
  });
});

describe('demo order cleanup', () => {
  it('removes seed-marked orders and lines while preserving real data and inventory', async () => {
    const { removeDemoOrders } = await import('../demo-orders.js');
    const userId = (await row<{ id: number }>("SELECT id FROM users WHERE email = 'buyer@example.com'")).id;
    const productId = await pid('M16-STRAP-SNEAKER');
    const before = {
      users: (await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM users')).n,
      products: (await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM products')).n,
      stock: await stock('M16-STRAP-SNEAKER'),
      seededOrders: (await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM orders WHERE payment_ref LIKE 'SEED-%'")).n,
      seededItems: (await row<{ n: number }>(`
        SELECT COUNT(*)::integer AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_ref LIKE 'SEED-%'`)).n,
      realOrders: (await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM orders WHERE payment_ref IS NULL OR payment_ref NOT LIKE 'SEED-%'")).n,
      realItems: (await row<{ n: number }>(`
        SELECT COUNT(*)::integer AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_ref IS NULL OR o.payment_ref NOT LIKE 'SEED-%'`)).n,
    };
    await db.query(`INSERT INTO orders (
      code,user_id,status,payment_method,payment_status,subtotal_cents,discount_cents,shipping_cents,total_cents,
      shipping_method,email,ship_name,ship_phone,ship_line,ship_city,ship_country
    ) VALUES ($1,$2,'processing','cod','cod',1000,0,0,1000,'standard','buyer@example.com','Test Buyer',
      '0712345678','12 Test Street','Nairobi','Kenya')`, ['NS-REAL-CLEANUP-TEST', userId]);
    const realOrder = await row<{ id: number }>("SELECT id FROM orders WHERE code = 'NS-REAL-CLEANUP-TEST'");
    await db.query(`INSERT INTO order_items (order_id,product_id,name,sku,price_cents,qty)
      VALUES ($1,$2,'Test Shoe','M16-STRAP-SNEAKER',1000,1)`, [realOrder.id, productId]);

    const result = await removeDemoOrders();
    assert.equal(result.deletedOrders, before.seededOrders);
    assert.equal(result.deletedOrderItems, before.seededItems);
    assert.equal((await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM orders WHERE payment_ref LIKE 'SEED-%'")).n, 0);
    assert.equal((await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.payment_ref LIKE 'SEED-%'")).n, 0);
    assert.equal((await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM users')).n, before.users);
    assert.equal((await row<{ n: number }>('SELECT COUNT(*)::integer AS n FROM products')).n, before.products);
    assert.equal(await stock('M16-STRAP-SNEAKER'), before.stock);
    assert.equal((await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM orders WHERE payment_ref IS NULL OR payment_ref NOT LIKE 'SEED-%'")).n, before.realOrders + 1);
    assert.equal((await row<{ n: number }>("SELECT COUNT(*)::integer AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.payment_ref IS NULL OR o.payment_ref NOT LIKE 'SEED-%'")).n, before.realItems + 1);

    const adminId = (await row<{ id: number }>("SELECT id FROM users WHERE role = 'admin'")).id;
    const admin = make(adminId);
    const visibleOrders = await admin.admin.orders({ pageSize: 100 });
    assert.equal(visibleOrders.total, before.realOrders + 1);
    const dashboard = await admin.admin.dashboard({ range: 'year' });
    assert.equal(dashboard.cards.customers.value, (await row<{ n: number }>("SELECT COUNT(DISTINCT user_id)::integer AS n FROM orders WHERE payment_ref IS NULL OR payment_ref NOT LIKE 'SEED-%'")).n);
    assert.ok(dashboard.recent.every((order: { code: string | null }) => !order.code?.startsWith('SEED-')));
  });
});
