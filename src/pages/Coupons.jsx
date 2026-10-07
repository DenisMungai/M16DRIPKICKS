import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Plus } from 'lucide-react';
import Page from '../components/Page.jsx';
import { Query } from '../components/Async.jsx';
import { useCart } from '../cart.jsx';
import { date, errMsg, money } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

const daysLeft = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function Coupons() {
  const list = trpc.coupons.mine.useQuery();
  const utils = trpc.useUtils();
  const { setCoupon, lines } = useCart();
  const toast = useToast();
  const [copied, setCopied] = useState(null);
  const [code, setCode] = useState('');
  const claim = trpc.coupons.claim.useMutation({
    onSuccess: (r) => { utils.coupons.mine.invalidate(); setCode(''); toast.show(`${r.code} added to your wallet`); },
  });

  const copy = async (c) => {
    try { await navigator.clipboard.writeText(c); } catch { /* clipboard unavailable */ }
    setCopied(c);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <Page title="My coupons" intro="Your discount codes, seasonal offers and reward vouchers. Apply them at checkout.">
      <Query q={list}>
        {(coupons) => (
          <div className="grid gap-gutter md:grid-cols-2">
            {coupons.map((c) => (
              <article key={c.code} className={`card flex flex-col p-6 ${c.expired ? 'bg-mist' : ''}`}>
                <div className="flex items-center justify-between text-micro">
                  <span className={`rounded-sm px-2 py-1 font-medium ${c.expired ? 'bg-stone text-ink-soft' : 'bg-ink text-white'}`}>{c.tag}</span>
                  {c.expiresAt && <span className="text-ink-soft">{c.expired ? `Expired ${date(c.expiresAt)}` : daysLeft(c.expiresAt) <= 7 ? `Expires in ${daysLeft(c.expiresAt)} day${daysLeft(c.expiresAt) === 1 ? '' : 's'}` : `Valid until ${date(c.expiresAt)}`}</span>}
                </div>
                <h2 className={`mt-4 text-display-sm ${c.expired ? 'text-ink-faint line-through' : ''}`}>{c.title}</h2>
                <p className="mt-2 flex-1 text-small text-ink-soft">{c.note}{c.minSpend > 0 && ` Minimum spend ${money(c.minSpend)}.`}</p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-4">
                  <p className="text-small text-ink-soft">Code <span className="ml-1 font-semibold tracking-wide text-ink">{c.code}</span></p>
                  <div className="flex gap-2">
                    <button disabled={c.expired} onClick={() => copy(c.code)} className="btn-secondary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-40">
                      {copied === c.code ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
                    </button>
                    {!c.expired && lines.length > 0 && <Link to="/cart" onClick={() => setCoupon(c.code)} className="btn-primary px-4 py-2.5">Use in cart</Link>}
                  </div>
                </div>
              </article>
            ))}

            <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) claim.mutate({ code }); }} className="flex flex-col justify-center rounded-xl border border-dashed border-ink-faint bg-card p-6">
              <Plus className="h-6 w-6" />
              <h2 className="mt-3 text-title">Have a promo code?</h2>
              <p className="text-small text-ink-soft">Enter it here to add it to your wallet.</p>
              <div className="mt-4 flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" aria-label="Promo code" className="min-w-0 flex-1 border border-line bg-card px-4 py-3 text-small uppercase focus:border-ink focus:outline-none" />
                <button className="btn-primary px-6 py-3" disabled={claim.isPending}>Apply</button>
              </div>
              {claim.error && <p role="alert" className="mt-2 text-small text-sale">{errMsg(claim.error)}</p>}
            </form>
          </div>
        )}
      </Query>
    </Page>
  );
}
