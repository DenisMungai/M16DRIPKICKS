import crypto from 'node:crypto';
import { config } from './config.js';
import { hashPassword } from './auth.js';
import { syncAdminAccount } from './admin-account.js';
import { db } from './db.js';
import { catalogBrand, catalogCategories, catalogInitialStock, catalogProducts } from './catalog.js';

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const usdCentsFromKes = (kes: number) => Math.round((kes / config.kesPerUsd) * 100);

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const customers = ['Sarah Jenkins', 'Michael Chang', 'Emily Rose', 'Daniel Mwangi', 'Aisha Khan', 'Brian Otieno', 'Grace Wanjiru', 'Lucas Meyer'];

async function refreshCatalogRows() {
  const createdAt = new Date().toISOString();
  await db.transaction(async (client) => {
    for (const name of catalogCategories) {
      await client.query(
        'INSERT INTO categories (name, slug) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING',
        [name, slug(name)],
      );
    }
    await client.query(
      'INSERT INTO brands (name, blurb, cta) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET blurb=EXCLUDED.blurb, cta=EXCLUDED.cta',
      [catalogBrand.name, catalogBrand.blurb, catalogBrand.cta],
    );
    const categoryPlaceholders = catalogCategories.map((_, index) => `$${index + 1}`).join(',');
    const categoryIds = await client.query<{ id: number; name: string }>(
      `SELECT id, name FROM categories WHERE name IN (${categoryPlaceholders})`,
      [...catalogCategories],
    );
    const categories = new Map(categoryIds.rows.map((row) => [row.name, row.id]));
    const brand = await client.query<{ id: number }>('SELECT id FROM brands WHERE name = $1', [catalogBrand.name]);
    const brandId = brand.rows[0].id;

    await client.query('UPDATE products SET active = 0 WHERE active = 1');
    for (const product of catalogProducts) {
      const categoryId = categories.get(product.category);
      if (!categoryId) throw new Error(`Missing catalog category: ${product.category}`);
      await client.query(`INSERT INTO products (
        sku,name,sub,description,category_id,brand_id,price_cents,was_cents,badge,is_new,
        rating,review_count,stock,sold,image,sizes,colors,active,created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,1,0,0,$8,0,$9,$10,$11,1,$12)
      ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, sub=EXCLUDED.sub, description=EXCLUDED.description,
        category_id=EXCLUDED.category_id, brand_id=EXCLUDED.brand_id, price_cents=EXCLUDED.price_cents,
        was_cents=NULL, badge=NULL, is_new=1,
        stock=CASE WHEN products.stock=0 THEN EXCLUDED.stock ELSE products.stock END,
        image=EXCLUDED.image, sizes=EXCLUDED.sizes, colors=EXCLUDED.colors, active=1`, [
        product.sku, product.name, product.sub, product.description, categoryId, brandId,
        usdCentsFromKes(product.priceKes), catalogInitialStock, product.image, JSON.stringify(product.sizes ?? []),
        JSON.stringify(product.colors ?? []), createdAt,
      ]);
    }
    await client.query(`UPDATE coupons SET
      title='KSh 1,500 off your first order',
      note='Minimum spend of KSh 10,000 required. One use per customer.',
      value=$1, min_spend_cents=$2 WHERE code='WELCOME15'`,
    [usdCentsFromKes(1500), usdCentsFromKes(10000)]);
  });
}

export async function refreshCatalog() {
  await refreshCatalogRows();
  return catalogProducts.length;
}

export async function resetAll() {
  await db.query(`TRUNCATE order_items, orders, wishlist, user_coupons, coupons, addresses, products, brands, categories, users
    RESTART IDENTITY CASCADE`);
}

type SeedOrder = {
  user: number; ageDays: number; status: string; method: 'card' | 'mpesa' | 'cod'; express?: boolean; tracking?: string;
  items: { sku: string; qty: number; size?: string }[]; name: string; line: string; city: string; coupon?: string; discountPct?: number;
};

export async function seedAll() {
  const now = Date.now();
  const rand = rng(42);
  await refreshCatalogRows();
  const coupons = [
    ['SUMMER25', 'Summer event', '25% off sitewide', 'Valid on every order. Cannot be combined with other codes.', 'percent', 25, 0, iso(now + 30 * DAY), 0],
    ['WELCOME15', 'New user', 'KSh 1,500 off your first order', 'Minimum spend of KSh 10,000 required. One use per customer.', 'fixed', usdCentsFromKes(1500), usdCentsFromKes(10000), null, 1],
    ['FREESHIP24', 'Rewards', 'Free shipping', 'Takes the delivery fee off any order, including express.', 'freeship', 0, 0, null, 0],
    ['KICKS10', 'Offer', '10% off footwear', 'Expired on Oct 15, 2023.', 'percent', 10, 0, '2023-10-15T00:00:00.000Z', 0],
  ] as const;
  await db.transaction(async (client) => {
    for (const [code, tag, title, note, type, value, minSpend, expires, onePerUser] of coupons) {
      await client.query(`INSERT INTO coupons (code,tag,title,note,type,value,min_spend_cents,expires_at,one_per_user,auto_grant,active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,1) ON CONFLICT (code) DO NOTHING`,
      [code, tag, title, note, type, value, minSpend, expires, onePerUser]);
    }
  });

  let adminPassword = config.adminPassword;
  if (!adminPassword) {
    adminPassword = crypto.randomBytes(9).toString('base64url');
    console.log(`\n[seed] ADMIN_PASSWORD not set. Generated one for ${config.adminEmail}: ${adminPassword}\n       Save it now; it is not shown again.\n`);
  }
  const adminId = await syncAdminAccount(config.adminEmail, adminPassword);
  const automaticCoupons = await db.query<{ id: number }>('SELECT id FROM coupons WHERE auto_grant=1');
  for (const coupon of automaticCoupons.rows) {
    await db.query('INSERT INTO user_coupons (user_id,coupon_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [adminId, coupon.id]);
  }

  if (!config.seedDemoData) return;
  const demoHash = await hashPassword('Demo1234!');
  await db.transaction(async (client) => {
    const demoResult = await client.query<{ id: number }>(
      `INSERT INTO users (email,name,phone,mpesa_phone,password_hash,created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['demo@novashop.test', 'Alina Putri', '+254712345678', '0712345678', demoHash, iso(now - 200 * DAY)],
    );
    const demoId = demoResult.rows[0].id;
    const ids: number[] = [];
    for (const [i, name] of customers.entries()) {
      const inserted = await client.query<{ id: number }>(
        'INSERT INTO users (email,name,password_hash,created_at) VALUES ($1,$2,$3,$4) RETURNING id',
        [`${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`, name, demoHash, iso(now - (300 - i * 35 - Math.floor(rand() * 20)) * DAY)],
      );
      ids.push(inserted.rows[0].id);
    }
    const autoCoupons = await client.query<{ id: number }>('SELECT id FROM coupons WHERE auto_grant=1');
    const customerRows = await client.query<{ id: number }>("SELECT id FROM users WHERE role='customer'");
    for (const customer of customerRows.rows) {
      for (const coupon of autoCoupons.rows) {
        await client.query('INSERT INTO user_coupons (user_id,coupon_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [customer.id, coupon.id]);
      }
    }
    await client.query(
      'INSERT INTO addresses (user_id,label,name,phone,line1,city,country,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,1)',
      [demoId, 'Home', 'Alina Putri', '+254712345678', 'Kenyatta Road, Apt 4B', 'Juja', 'Kenya'],
    );
    await client.query(
      'INSERT INTO addresses (user_id,label,name,phone,line1,city,country,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,0)',
      [demoId, 'Office', 'Alina Putri', '+254712345678', 'Westlands Business Park, Level 5', 'Nairobi', 'Kenya'],
    );

    const productResult = await client.query<{ id: number; sku: string; name: string; price_cents: number; sizes: string }>(
      'SELECT id,sku,name,price_cents,sizes FROM products WHERE active=1',
    );
    const bySku = new Map(productResult.rows.map((product) => [product.sku, product]));
    const codeOf = () => `NS-${[...crypto.randomBytes(6)].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')}`;

    const insertOrder = async (order: SeedOrder) => {
      const lines = order.items.map((item) => {
        const product = bySku.get(item.sku);
        if (!product) throw new Error(`Missing seed product: ${item.sku}`);
        return { ...product, qty: item.qty, size: item.size ?? null };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.price_cents * line.qty, 0);
      const discount = order.discountPct ? Math.round((subtotal * order.discountPct) / 100) : 0;
      const shipping = order.express ? config.shippingCents.express : 0;
      const total = subtotal - discount + shipping;
      const paid = order.status !== 'cancelled' && (order.method !== 'cod' || order.status === 'delivered');
      const paymentStatus = order.status === 'cancelled' ? 'failed' : paid ? 'paid' : 'cod';
      const created = iso(now - order.ageDays * DAY);
      const customer = await client.query<{ email: string }>('SELECT email FROM users WHERE id=$1', [order.user]);
      const result = await client.query<{ id: number }>(`INSERT INTO orders (
        code,user_id,status,payment_method,payment_status,payment_ref,subtotal_cents,discount_cents,
        shipping_cents,total_cents,coupon_code,shipping_method,email,ship_name,ship_phone,ship_line,ship_city,ship_country,tracking,created_at,updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`, [
        codeOf(), order.user, order.status, order.method, paymentStatus, `SEED-${order.method}`, subtotal, discount, shipping, total,
        order.coupon ?? null, order.express ? 'express' : 'standard', customer.rows[0].email, order.name, '+254700000000', order.line,
        order.city, 'Kenya', order.tracking ?? null, created, created,
      ]);
      for (const line of lines) {
        await client.query(
          'INSERT INTO order_items (order_id,product_id,name,sku,price_cents,qty,size,color) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)',
          [result.rows[0].id, line.id, line.name, line.sku, line.price_cents, line.qty, line.size],
        );
      }
    };

    await insertOrder({ user: demoId, ageDays: 12, status: 'delivered', method: 'card', items: [{ sku: 'M16-BOOT-PATENT', qty: 1 }], name: 'Alina Putri', line: 'Kenyatta Road, Apt 4B', city: 'Juja', tracking: 'TRK10928374' });
    await insertOrder({ user: demoId, ageDays: 3, status: 'shipped', method: 'mpesa', items: [{ sku: 'M16-NAVY-LOWTOP', qty: 1 }], name: 'Alina Putri', line: 'Kenyatta Road, Apt 4B', city: 'Juja', tracking: 'TRK55820193' });
    await insertOrder({ user: demoId, ageDays: 0.2, status: 'processing', method: 'cod', express: true, items: [{ sku: 'M16-GRAPHIC-TEE', qty: 2 }, { sku: 'M16-STRAP-SNEAKER', qty: 1 }], name: 'Alina Putri', line: 'Westlands Business Park, Level 5', city: 'Nairobi' });

    const all = [...bySku.keys()];
    for (let n = 0; n < 90; n++) {
      const ageDays = Math.floor(Math.pow(rand(), 1.6) * 340) + 1;
      const k = 1 + Math.floor(rand() * 3);
      const items = Array.from({ length: k }, () => {
        const sku = all[Math.floor(rand() * all.length)];
        const sizes = JSON.parse(bySku.get(sku)!.sizes) as string[];
        return { sku, qty: 1 + Math.floor(rand() * 2), size: sizes.length ? sizes[Math.floor(rand() * sizes.length)] : undefined };
      }).filter((item, i, arr) => arr.findIndex((candidate) => candidate.sku === item.sku) === i);
      const r = rand();
      const status = ageDays > 10 ? (r < 0.06 ? 'cancelled' : 'delivered') : r < 0.2 ? 'cancelled' : r < 0.5 ? 'processing' : r < 0.8 ? 'shipped' : 'delivered';
      const methodRoll = rand();
      const user = ids[Math.floor(rand() * ids.length)];
      const name = (await client.query<{ name: string }>('SELECT name FROM users WHERE id=$1', [user])).rows[0].name;
      await insertOrder({
        user, ageDays, status, method: methodRoll < 0.45 ? 'card' : methodRoll < 0.85 ? 'mpesa' : 'cod',
        express: rand() < 0.25, items, name, line: 'Sample Street 12', city: 'Nairobi',
        tracking: status === 'shipped' || status === 'delivered' ? `TRK${Math.floor(1e7 + rand() * 9e7)}` : undefined,
        coupon: rand() < 0.15 ? 'SUMMER25' : undefined,
      });
    }

    for (const sku of ['M16-STRAP-SNEAKER', 'M16-RETRO-RUNNER', 'M16-GRAPHIC-TEE']) {
      const product = bySku.get(sku);
      if (product) await client.query('INSERT INTO wishlist (user_id,product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [demoId, product.id]);
    }
  });
}

export async function seedIfEmpty() {
  const result = await db.query<{ n: number }>('SELECT COUNT(*)::integer AS n FROM products');
  if (result.rows[0].n > 0) return false;
  await seedAll();
  console.log(`[seed] catalog ready${config.seedDemoData ? ' with demo data' : ''}. Admin: ${config.adminEmail}`);
  return true;
}

if (process.argv[1]?.endsWith('seed.ts')) {
  (async () => {
    const { initializeDatabase } = await import('./db.js');
    await initializeDatabase();
    if (process.argv.includes('--catalog')) {
      const existing = await db.query<{ n: number }>('SELECT COUNT(*)::integer AS n FROM products');
      if (existing.rows[0].n === 0) {
        await seedAll();
        console.log('[catalog] initialized an empty database with the M16 Drip catalog.');
        return;
      }
      const count = await refreshCatalog();
      console.log(`[catalog] refreshed ${count} M16 Drip products; accounts and order history were preserved.`);
      return;
    }
    if (process.argv.includes('--reset')) await resetAll();
    await seedAll();
    console.log('[seed] done');
    if (config.seedDemoData) console.log('  admin:    ' + config.adminEmail + ' / ' + (config.adminPassword || '(generated above)') + '\n  customer: demo@novashop.test / Demo1234!');
  })().catch((error) => { console.error(error); process.exit(1); });
}
