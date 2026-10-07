import { Lock, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { lineKey, useCart, useQuote } from '../cart.jsx';
import { money } from '../format.js';

export default function CartPanel() {
  const { lines, count, remove, setOpen } = useCart();
  const quote = useQuote();
  const q = quote.data;
  if (!lines.length) return null;

  return (
    <aside className="w-full shrink-0 lg:w-[360px]" aria-label="Cart">
      <div className="card sticky top-24 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-title">My cart ({count})</h2>
          <button onClick={() => setOpen(false)} aria-label="Close cart" className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
        </div>

        {!q ? <p className="py-8 text-small text-ink-soft">Updating prices…</p> : (
          <>
            <ul className="mb-6 flex max-h-[300px] flex-col gap-4 overflow-y-auto pr-1">
              {q.lines.map((l) => (
                <li key={l.key} className="flex items-center gap-4">
                  {l.unavailable ? (
                    <p className="flex-1 text-small text-ink-soft">This item is no longer available.</p>
                  ) : (
                    <>
                      <ProductImage product={{ name: l.name, image: l.image, category: l.category }} className="h-16 w-16 shrink-0 rounded-md" size="h-6 w-6" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-medium">{l.name}</p>
                        <p className="text-micro text-ink-soft">{[l.size && `Size ${l.size}`, `Qty ${l.qty}`].filter(Boolean).join(' · ')}</p>
                        <p className="text-small font-semibold">{money(l.lineTotal)}</p>
                      </div>
                    </>
                  )}
                  <button onClick={() => remove(l.key)} className="text-micro text-ink-faint underline hover:text-ink">Remove</button>
                </li>
              ))}
            </ul>
            <hr className="mb-6 border-line" />
            <dl className="space-y-2 text-small">
              <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="font-semibold">{money(q.subtotal)}</dd></div>
              {q.discount > 0 && <div className="flex justify-between"><dt className="text-ink-soft">Discount ({q.coupon?.code})</dt><dd className="font-semibold text-sale">-{money(q.discount)}</dd></div>}
              <div className="flex justify-between pt-2 text-title"><dt>Total</dt><dd>{money(q.total)}</dd></div>
            </dl>
            <Link to="/checkout" className="btn-primary mt-6 w-full"><Lock className="h-4 w-4" /> Checkout</Link>
            <Link to="/cart" className="mt-3 block text-center text-small font-medium underline-offset-4 hover:underline">View full cart</Link>
          </>
        )}
      </div>
    </aside>
  );
}
