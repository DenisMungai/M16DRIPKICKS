import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Minus, Plus } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Empty, Loading } from '../components/Async.jsx';
import { useCart, useQuote } from '../cart.jsx';
import { money } from '../format.js';

export function CouponBox({ quote }) {
  const { coupon, setCoupon } = useCart();
  const [v, setV] = useState('');
  const c = quote?.coupon;
  return (
    <div className="border-t border-line pt-5">
      {coupon ? (
        <div className="flex items-start justify-between gap-3 text-small">
          <div>
            <p className="font-medium">{coupon}</p>
            <p className={c?.ok ? 'text-ink-soft' : 'text-sale'}>{c ? (c.ok ? c.title : c.message) : 'Checking…'}</p>
          </div>
          <button onClick={() => setCoupon('')} className="underline underline-offset-4 hover:text-ink-soft">Remove</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { setCoupon(v); setV(''); } }} className="flex gap-2">
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Discount code" aria-label="Discount code" className="min-w-0 flex-1 border border-line bg-card px-4 py-3 text-small uppercase focus:border-ink focus:outline-none" />
          <button className="btn-secondary px-5 py-3">Apply</button>
        </form>
      )}
    </div>
  );
}

export default function Cart() {
  const { lines, count, setQty, remove } = useCart();
  const quote = useQuote();
  const q = quote.data;

  if (!lines.length) {
    return (
      <Page title="Your cart">
        <Empty title="Your cart is empty">Add something you like and it will show up here.<div><Link to="/new-arrivals" className="btn-primary mt-6">Browse new arrivals</Link></div></Empty>
      </Page>
    );
  }
  if (!q) return <Page title="Your cart"><Loading label="Updating prices" /></Page>;

  const blocked = q.issues.length > 0 || (q.coupon && !q.coupon.ok) || q.lines.some((l) => l.unavailable);

  return (
    <Page title="Your cart" intro={`${count} item${count === 1 ? '' : 's'}`} wide>
      <div className="grid gap-gutter lg:grid-cols-[1fr_380px]">
        <div>
          {q.issues.length > 0 && (
            <ul role="alert" className="mb-4 space-y-1 rounded-lg border border-sale bg-card p-4 text-small text-sale">
              {q.issues.map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}
          <ul className="card divide-y divide-line">
            {q.lines.map((l) => (
              <li key={l.key} className="flex flex-wrap items-center gap-5 p-5">
                {l.unavailable ? (
                  <>
                    <p className="flex-1 text-small text-ink-soft">This item is no longer available.</p>
                    <button onClick={() => remove(l.key)} className="text-small underline underline-offset-4">Remove</button>
                  </>
                ) : (
                  <>
                    <ProductImage product={{ name: l.name, image: l.image, category: l.category }} className="h-24 w-24 rounded-lg" size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/product/${l.productId}`} className="font-semibold hover:underline">{l.name}</Link>
                      <p className="text-small text-ink-soft">{[l.size && `Size ${l.size}`, l.color].filter(Boolean).join(' · ') || l.sub}</p>
                      <p className="text-small text-ink-soft">{money(l.unitPrice)} each</p>
                      <button onClick={() => remove(l.key)} className="mt-2 text-small text-ink-soft underline underline-offset-4 hover:text-ink">Remove</button>
                    </div>
                    <div className="flex items-center border border-line" role="group" aria-label={`Quantity for ${l.name}`}>
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label="Decrease" className="flex h-10 w-10 items-center justify-center hover:bg-stone"><Minus className="h-4 w-4" /></button>
                      <span className="w-8 text-center text-small font-medium" aria-live="polite">{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="Increase" className="flex h-10 w-10 items-center justify-center hover:bg-stone"><Plus className="h-4 w-4" /></button>
                    </div>
                    <p className="w-24 text-right text-title">{money(l.lineTotal)}</p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <aside className="card sticky top-24 h-max p-6">
          <h2 className="text-title">Order summary</h2>
          <dl className="mt-5 space-y-2 text-small">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="font-semibold">{money(q.subtotal)}</dd></div>
            {q.discount > 0 && <div className="flex justify-between"><dt className="text-ink-soft">Discount ({q.coupon?.code})</dt><dd className="font-semibold text-sale">-{money(q.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd className="font-semibold">Chosen at checkout</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-title"><dt>Total</dt><dd>{money(q.total)}</dd></div>
          </dl>
          <div className="mt-5"><CouponBox quote={q} /></div>
          {blocked ? (
            <button disabled className="btn-primary mt-6 w-full cursor-not-allowed opacity-40"><Lock className="h-4 w-4" /> Checkout</button>
          ) : (
            <Link to="/checkout" className="btn-primary mt-6 w-full"><Lock className="h-4 w-4" /> Checkout</Link>
          )}
          {blocked && <p className="mt-3 text-micro text-ink-soft">Fix the items above to continue.</p>}
          <Link to="/coupons" className="mt-3 block text-center text-small font-medium underline-offset-4 hover:underline">See my coupons</Link>
        </aside>
      </div>
    </Page>
  );
}
