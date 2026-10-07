import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductImage from '../components/ProductImage.jsx';
import WishlistButton from '../components/WishlistButton.jsx';
import { ErrorBox, Loading } from '../components/Async.jsx';
import { useCart } from '../cart.jsx';
import { money } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

function Related({ id }) {
  const rel = trpc.catalog.products.related.useQuery({ id });
  const rail = useRef(null);
  const scroll = (dir) => rail.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  if (!rel.data?.length) return null;
  return (
    <section className="mt-16 border-t border-line pt-10" aria-labelledby="liked">
      <div className="mb-6 flex items-center justify-between">
        <h2 id="liked" className="text-display-sm">Customers also liked</h2>
        <div className="flex gap-2">
          <button onClick={() => scroll(-1)} aria-label="Previous" className="flex h-10 w-10 items-center justify-center border border-line bg-card hover:border-ink"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll(1)} aria-label="Next" className="flex h-10 w-10 items-center justify-center bg-ink text-white hover:bg-neutral-800"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={rail} className="hide-scrollbar flex snap-x gap-gutter overflow-x-auto pb-2">
        {rel.data.map((r) => (
          <Link key={r.id} to={`/product/${r.id}`} className="card group w-64 shrink-0 snap-start overflow-hidden">
            <div className="relative">
              <ProductImage product={r} className="aspect-square w-full" size="h-16 w-16" />
              {r.badge && <span className="absolute left-3 top-3 rounded-sm bg-ink px-2 py-1 text-micro font-medium text-white">{r.badge}</span>}
            </div>
            <div className="p-4">
              <p className="font-semibold group-hover:underline">{r.name}</p>
              <p className="text-micro text-ink-soft">{r.category}</p>
              <p className="mt-2 flex items-baseline gap-2 text-small font-semibold">
                <span className={r.was ? 'text-sale' : ''}>{money(r.price)}</span>
                {r.was && <span className="font-normal text-ink-faint line-through">{money(r.was)}</span>}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const pid = Number(id);
  const q = trpc.catalog.products.byId.useQuery({ id: pid }, { enabled: Number.isInteger(pid) });
  const { add } = useCart();
  const toast = useToast();
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);

  useEffect(() => { setSize(null); setQty(1); setNeedSize(false); setColor(q.data?.colors?.[0]?.name ?? null); }, [q.data?.id]);

  if (q.isLoading) return <Page><Loading /></Page>;
  if (q.error) {
    return (
      <Page title="Product not found">
        <ErrorBox error={q.error} />
        <Link to="/shop" className="btn-primary mt-6">Browse all products</Link>
      </Page>
    );
  }

  const p = q.data;
  const soldOut = p.stock === 0;
  const maxQty = Math.min(10, p.stock);

  const submit = () => {
    if (p.sizes.length && !size) { setNeedSize(true); return; }
    add({ productId: p.id, qty, size, color });
    toast.show(`${p.name} added to your cart`, { to: '/cart', label: 'View cart' });
  };

  return (
    <Page wide>
      <nav aria-label="Breadcrumb" className="mb-6 text-small text-ink-soft">
        <Link to="/" className="hover:text-ink">Home</Link> / <Link to={`/shop?category=${p.categorySlug}`} className="hover:text-ink">{p.category}</Link> / <span className="font-medium text-ink">{p.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative">
          <ProductImage product={p} className="aspect-[4/3] w-full rounded-xl border border-line" size="h-32 w-32" tone="bg-stone" />
          <WishlistButton productId={p.id} className="absolute right-4 top-4 !h-11 !w-11" />
        </div>

        <div>
          {p.badge && <span className="inline-block rounded-sm bg-ink px-3 py-1 text-micro font-medium text-white">{p.badge}</span>}
          <h1 className="mt-3 text-display-sm">{p.name}</h1>
          <p className="mt-1 text-title text-ink-soft">{p.sub}</p>
          {p.reviews > 0 && <p className="mt-3 flex items-center gap-1 text-small"><Star className="h-4 w-4 fill-ink" /> {p.rating} <span className="text-ink-soft">({p.reviews.toLocaleString()} reviews)</span></p>}
          <div className="mt-5 flex items-baseline gap-3">
            <p className={`text-display-sm ${p.was ? 'text-sale' : ''}`}>{money(p.price)}</p>
            {p.was && <><p className="text-body text-ink-faint line-through">{money(p.was)}</p><span className="rounded-sm bg-sale px-2 py-1 text-micro font-semibold text-white">-{p.discountPct}%</span></>}
          </div>

          {p.colors.length > 0 && (
            <>
              <p className="mt-8 text-small text-ink-soft">Colour: <span className="font-medium text-ink">{color}</span></p>
              <div className="mt-3 flex gap-3">
                {p.colors.map((c) => (
                  <button key={c.name} onClick={() => setColor(c.name)} aria-label={c.name} aria-pressed={color === c.name}
                    className={`h-11 w-11 rounded-full border-2 p-1 ${color === c.name ? 'border-ink' : 'border-line'}`}>
                    <span className="block h-full w-full rounded-full border border-line" style={{ background: c.swatch }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {p.sizes.length > 0 && (
            <>
              <div className="mt-8 flex items-center justify-between text-small">
                <span className={needSize ? 'font-medium text-sale' : 'text-ink-soft'}>{needSize ? 'Select a size to continue' : 'Select size'}</span>
                <Link to="/help/size-guide" className="font-medium underline underline-offset-4">Size guide</Link>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {p.sizes.map((s) => (
                  <button key={s} onClick={() => { setSize(s); setNeedSize(false); }} aria-pressed={size === s}
                    className={`border py-3 text-small font-medium transition-colors ${size === s ? 'border-ink bg-ink text-white' : needSize ? 'border-sale bg-card' : 'border-line bg-card hover:border-ink'}`}>{s}</button>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-small text-ink-soft">{soldOut ? 'Sold out' : p.stock < 10 ? `Only ${p.stock} left in stock` : 'In stock · ships in 1–2 business days'}</p>

          <div className="mt-4 flex gap-3">
            <div className="flex items-center border border-line" role="group" aria-label="Quantity">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease" className="flex h-14 w-12 items-center justify-center hover:bg-stone"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center text-small font-medium" aria-live="polite">{qty}</span>
              <button onClick={() => setQty(Math.min(maxQty || 1, qty + 1))} aria-label="Increase" className="flex h-14 w-12 items-center justify-center hover:bg-stone"><Plus className="h-4 w-4" /></button>
            </div>
            <button onClick={submit} disabled={soldOut} className="btn-primary flex-1 active:bg-white active:text-ink disabled:cursor-not-allowed disabled:bg-stone disabled:text-ink-faint">
              <ShoppingBag className="h-4 w-4" /> {soldOut ? 'Sold out' : 'Add to cart'}
            </button>
          </div>

          {p.description && <p className="mt-8 border-t border-line pt-6 text-body text-ink-soft">{p.description}</p>}
          <p className="mt-4 text-micro text-ink-faint">SKU {p.sku}{p.brand ? ` · ${p.brand}` : ''}</p>
        </div>
      </div>

      <Related id={p.id} />
    </Page>
  );
}
