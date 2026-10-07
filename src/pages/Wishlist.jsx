import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Empty, Query } from '../components/Async.jsx';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { errMsg, money } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

export default function Wishlist() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.wishlist.list.useQuery(undefined, { enabled: !!user });
  const { add } = useCart();
  const toast = useToast();
  const refresh = () => { utils.wishlist.list.invalidate(); utils.wishlist.ids.invalidate(); };
  const toggle = trpc.wishlist.toggle.useMutation({ onSuccess: refresh, onError: (e) => toast.show(errMsg(e)) });
  const clearAll = trpc.wishlist.clear.useMutation({ onSuccess: refresh });

  if (!user) {
    return (
      <Page title="Wishlist">
        <Empty title="Sign in to see your wishlist">Save products you like and find them here on any device.<div><Link to="/login?next=/wishlist" className="btn-primary mt-6">Sign in</Link></div></Empty>
      </Page>
    );
  }

  return (
    <Page
      title="Wishlist"
      intro={list.data ? `${list.data.length} item${list.data.length === 1 ? '' : 's'} saved` : undefined}
      actions={list.data?.length > 0 && <button onClick={() => clearAll.mutate()} className="flex items-center gap-2 text-small font-medium hover:underline"><X className="h-4 w-4" /> Clear all</button>}
    >
      <Query q={list}>
        {(items) => items.length === 0 ? (
          <Empty title="Nothing saved yet">Tap the heart on any product to keep it here.<div><Link to="/new-arrivals" className="btn-primary mt-6">Browse new arrivals</Link></div></Empty>
        ) : (
          <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => {
              const out = p.stock === 0;
              return (
                <article key={p.id} className="card relative overflow-hidden">
                  <button onClick={() => toggle.mutate({ productId: p.id })} aria-label={`Remove ${p.name}`} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card hover:border-ink"><X className="h-4 w-4" /></button>
                  <Link to={`/product/${p.id}`}><ProductImage product={p} className={`aspect-square w-full ${out ? 'opacity-60' : ''}`} size="h-20 w-20" /></Link>
                  <div className="p-5">
                    <p className="text-micro font-medium text-ink-soft">{out ? 'Out of stock' : p.stock < 10 ? 'Low stock' : 'In stock'}</p>
                    <Link to={`/product/${p.id}`} className="mt-1 block text-body font-semibold hover:underline">{p.name}</Link>
                    <p className="mt-1 text-title">{money(p.price)}</p>
                    {out ? <button disabled className="btn-secondary mt-4 w-full cursor-not-allowed py-3 opacity-50">Sold out</button>
                      : p.sizes.length ? <Link to={`/product/${p.id}`} className="btn-secondary mt-4 w-full py-3">Choose size</Link>
                      : <button onClick={() => { add({ productId: p.id }); toast.show(`${p.name} added to your cart`, { to: '/cart', label: 'View cart' }); }} className="btn-primary mt-4 w-full py-3">Quick add</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Query>
    </Page>
  );
}
