import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, CreditCard, Lock, Smartphone, Truck } from 'lucide-react';
import Page from '../components/Page.jsx';
import Field from '../components/Field.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Empty, Loading } from '../components/Async.jsx';
import { CouponBox } from './Cart.jsx';
import { useAuth } from '../auth.jsx';
import { useCart, useQuote } from '../cart.jsx';
import { errMsg, fieldErrors, kes, money } from '../format.js';
import { trpc } from '../trpc.ts';

export const PENDING_KEY = 'novashop.pending-order';

export default function Checkout() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { lines } = useCart();
  const cfg = trpc.meta.config.useQuery();
  const saved = trpc.addresses.list.useQuery();
  const [ship, setShip] = useState('standard');
  const [pay, setPay] = useState('mpesa');
  const [addrId, setAddrId] = useState(null); // null = new address form
  const [addr, setAddr] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', line1: '', line2: '', city: '', country: 'Kenya' });
  const [saveAddress, setSaveAddress] = useState(true);
  const [mpesa, setMpesa] = useState(user?.mpesaPhone ?? user?.phone ?? '');
  const quote = useQuote(ship);
  const q = quote.data;
  const create = trpc.orders.create.useMutation();
  const fe = fieldErrors(create.error);

  // Server-side validation messages disappear as soon as the customer edits anything.
  useEffect(() => {
    if (create.error) create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, mpesa, pay, ship, addrId, saveAddress]);

  useEffect(() => {
    if (saved.data?.length && addrId === null && !addr.line1) {
      setAddrId((saved.data.find((a) => a.isDefault) ?? saved.data[0]).id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.data]);

  if (!lines.length) {
    return <Page title="Checkout"><Empty title="Your cart is empty">Add something you like, then come back to check out.<div><Link to="/new-arrivals" className="btn-primary mt-6">Browse new arrivals</Link></div></Empty></Page>;
  }
  if (!q || !cfg.data) return <Page title="Checkout"><Loading /></Page>;

  const chosen = saved.data?.find((a) => a.id === addrId);
  const blocked = q.issues.length > 0 || (q.coupon && !q.coupon.ok);
  const set = (k) => (e) => setAddr({ ...addr, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const a = chosen ?? addr;
    try {
      const r = await create.mutateAsync({
        items: lines.map(({ productId, qty, size, color }) => ({ productId, qty, size, color })),
        couponCode: q.coupon?.ok ? q.coupon.code : null,
        shippingMethod: ship,
        paymentMethod: pay,
        mpesaPhone: pay === 'mpesa' ? mpesa : undefined,
        address: { name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 || null, city: a.city, country: a.country },
        saveAddress: !chosen && saveAddress,
      });
      sessionStorage.setItem(PENDING_KEY, r.code);
      if (r.redirectUrl) window.location.assign(r.redirectUrl);
      else nav(`/orders/${r.code}?placed=1`);
    } catch { /* shown below */ }
  };

  const payments = [
    { id: 'mpesa', label: 'M-Pesa', note: `We send a payment prompt to your phone${cfg.data.mpesaLive ? '' : ' (demo mode)'}`, icon: Smartphone },
    { id: 'card', label: 'Card', note: cfg.data.cardLive ? 'Pay securely on Stripe' : 'Demo mode: no card is charged', icon: CreditCard },
    { id: 'cod', label: 'Cash on delivery', note: 'Pay when your order arrives', icon: Banknote },
  ];

  return (
    <Page title="Checkout" intro="Review your details and place your order." wide>
      <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-gutter">
          <section className="card p-6">
            <h2 className="mb-5 text-title">Delivery address</h2>
            {saved.data?.length > 0 && (
              <div className="mb-5 space-y-2">
                {saved.data.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer items-start gap-3 border p-4 text-small ${addrId === a.id ? 'border-ink bg-mist' : 'border-line'}`}>
                    <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} className="mt-1 h-4 w-4 accent-black" />
                    <span><span className="block font-medium">{a.label} · {a.name}</span><span className="text-ink-soft">{[a.line1, a.line2, a.city, a.country].filter(Boolean).join(', ')} · {a.phone}</span></span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 border p-4 text-small ${addrId === null ? 'border-ink bg-mist' : 'border-line'}`}>
                  <input type="radio" name="addr" checked={addrId === null} onChange={() => setAddrId(null)} className="h-4 w-4 accent-black" /> Use a new address
                </label>
              </div>
            )}
            {!chosen && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" value={addr.name} onChange={set('name')} error={fe['address.name']} autoComplete="name" />
                <Field label="Phone number" type="tel" value={addr.phone} onChange={set('phone')} error={fe['address.phone']} autoComplete="tel" />
                <Field className="sm:col-span-2" label="Street address" value={addr.line1} onChange={set('line1')} error={fe['address.line1']} autoComplete="address-line1" />
                <Field className="sm:col-span-2" label="Apartment, building (optional)" value={addr.line2} onChange={set('line2')} autoComplete="address-line2" />
                <Field label="City" value={addr.city} onChange={set('city')} error={fe['address.city']} autoComplete="address-level2" />
                <Field label="Country" value={addr.country} onChange={set('country')} autoComplete="country-name" />
                <label className="flex items-center gap-2 text-small sm:col-span-2"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-black" /> Save this address for next time</label>
              </div>
            )}

            <fieldset className="mt-8">
              <legend className="mb-3 flex items-center gap-2 text-small font-medium"><Truck className="h-4 w-4" /> Delivery method</legend>
              <div className="space-y-2">
                {[['standard', 'Standard delivery', '3–5 business days', cfg.data.shippingStandard], ['express', 'Express delivery', 'Next business day', cfg.data.shippingExpress]].map(([id, label, note, price]) => (
                  <label key={id} className={`flex cursor-pointer items-center gap-3 border p-4 ${ship === id ? 'border-ink bg-mist' : 'border-line'}`}>
                    <input type="radio" name="ship" checked={ship === id} onChange={() => setShip(id)} className="h-4 w-4 accent-black" />
                    <span className="flex-1"><span className="block text-small font-medium">{label}</span><span className="text-micro text-ink-soft">{note}</span></span>
                    <span className="text-small font-semibold">{price ? money(price) : 'Free'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="card p-6">
            <h2 className="mb-5 text-title">Payment</h2>
            <div className="space-y-2" role="radiogroup" aria-label="Payment method">
              {payments.map(({ id, label, note, icon: Icon }) => (
                <label key={id} className={`flex cursor-pointer items-center gap-3 border p-4 ${pay === id ? 'border-ink bg-mist' : 'border-line'}`}>
                  <input type="radio" name="pay" checked={pay === id} onChange={() => setPay(id)} className="h-4 w-4 accent-black" />
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <span className="flex-1"><span className="block text-small font-medium">{label}</span><span className="text-micro text-ink-soft">{note}</span></span>
                </label>
              ))}
            </div>
            {pay === 'mpesa' && (
              <div className="mt-5">
                <Field label="M-Pesa phone number" type="tel" value={mpesa} onChange={(e) => setMpesa(e.target.value)} placeholder="0712 345 678" hint={`You will pay about ${kes(q.total)}. Enter your M-Pesa PIN when the prompt appears.`} />
              </div>
            )}
          </section>
        </div>

        <aside aria-label="Order summary">
          <div className="card sticky top-24 p-6">
            <h2 className="mb-5 text-title">Order summary</h2>
            <ul className="mb-5 max-h-64 space-y-4 overflow-y-auto pr-1">
              {q.lines.filter((l) => !l.unavailable).map((l) => (
                <li key={l.key} className="flex items-center gap-4">
                  <ProductImage product={{ name: l.name, image: l.image, category: l.category }} className="h-14 w-14 shrink-0 rounded-md" size="h-6 w-6" />
                  <div className="min-w-0 flex-1"><p className="truncate text-small font-medium">{l.name}</p><p className="text-micro text-ink-soft">{[l.size && `Size ${l.size}`, `Qty ${l.qty}`].filter(Boolean).join(' · ')}</p></div>
                  <p className="text-small font-semibold">{money(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <CouponBox quote={q} />
            <dl className="mt-5 space-y-2 border-t border-line pt-5 text-small">
              <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="font-semibold">{money(q.subtotal)}</dd></div>
              {q.discount > 0 && <div className="flex justify-between"><dt className="text-ink-soft">Discount</dt><dd className="font-semibold text-sale">-{money(q.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd className="font-semibold">{q.shipping ? money(q.shipping) : 'Free'}</dd></div>
              <div className="flex justify-between pt-2 text-title"><dt>Total</dt><dd>{money(q.total)}</dd></div>
            </dl>
            {q.issues.map((i) => <p key={i} role="alert" className="mt-3 text-small text-sale">{i}</p>)}
            {create.error && <p role="alert" className="mt-3 text-small text-sale">{errMsg(create.error)}</p>}
            <button disabled={blocked || create.isPending} className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40">
              <Lock className="h-4 w-4" /> {create.isPending ? 'Placing order…' : pay === 'cod' ? 'Place order' : `Pay ${money(q.total)}`}
            </button>
            {blocked && <Link to="/cart" className="mt-3 block text-center text-small font-medium underline underline-offset-4">Back to cart</Link>}
          </div>
        </aside>
      </form>
    </Page>
  );
}
