import { Link, Navigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { money, useCart } from '../cart.jsx';

export default function OrderConfirmation() {
  const { lastOrder: o } = useCart();
  if (!o) return <Navigate to="/" replace />;

  return (
    <Page wide>
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-white"><Check className="h-8 w-8" /></span>
          <h1 className="mt-6 text-display-sm">Thank you, your order is in</h1>
          <p className="mt-2 text-body text-ink-soft">
            We sent a confirmation to <span className="font-medium text-ink">{o.email}</span>. Order number <span className="font-medium text-ink">{o.id}</span>.
          </p>
        </div>

        <section className="card mt-10 p-6">
          <ul className="space-y-4">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4">
                <ProductImage product={i} className="h-14 w-14 shrink-0 rounded-md" size="h-6 w-6" />
                <div className="min-w-0 flex-1"><p className="truncate text-small font-medium">{i.name}</p><p className="text-micro text-ink-soft">Qty {i.qty}</p></div>
                <p className="text-small font-semibold">{money(i.price * i.qty)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-small">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Discount</dt><dd className="text-sale">-{money(o.discount)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">{o.shippingLabel}</dt><dd>{o.shipping ? money(o.shipping) : 'Free'}</dd></div>
            <div className="flex justify-between pt-2 text-title"><dt>Total</dt><dd>{money(o.total)}</dd></div>
          </dl>
          <div className="mt-5 grid gap-4 border-t border-line pt-5 text-small sm:grid-cols-2">
            <div><p className="text-ink-soft">Delivering to</p><p className="font-medium">{o.name}</p><p>{o.address}</p></div>
            <div><p className="text-ink-soft">Payment</p><p className="font-medium">{o.payment}</p></div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/orders" className="btn-primary">Track your order</Link>
          <Link to="/" className="btn-secondary">Continue shopping</Link>
        </div>
      </div>
    </Page>
  );
}
