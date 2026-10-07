import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ProductImage from './ProductImage.jsx';
import WishlistButton from './WishlistButton.jsx';
import { useCart } from '../cart.jsx';
import { money } from '../format.js';
import { useToast } from '../toast.jsx';

export default function ProductCard({ product: p, rank }) {
  const { add } = useCart();
  const toast = useToast();
  const soldOut = p.stock === 0;
  const needsSize = p.sizes.length > 0;

  const quickAdd = () => {
    add({ productId: p.id });
    toast.show(`${p.name} added to your cart`, { to: '/cart', label: 'View cart' });
  };

  return (
    <article className="market-card relative flex flex-col">
      {rank && (
        <span className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-small font-semibold text-white">{rank}</span>
      )}
      <div className="relative">
        <Link to={`/product/${p.id}`} className="block" aria-label={p.name}>
          <ProductImage product={p} className={`market-image w-full ${soldOut ? 'opacity-50' : ''}`} size="h-20 w-20" />
        </Link>
        <WishlistButton productId={p.id} className="absolute right-2 top-2 !h-8 !w-8 border-0 shadow-none" />
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1">
          {soldOut && <span className="rounded-sm bg-ink px-2 py-1 text-micro font-medium text-white">Sold out</span>}
          {!soldOut && p.badge && <span className="rounded-sm bg-ink px-2 py-1 text-micro font-medium text-white">{p.badge}</span>}
          {p.discountPct > 0 && <span className="rounded-sm bg-sale px-2 py-1 text-micro font-semibold text-white">-{p.discountPct}%</span>}
        </div>
      </div>
      <div className="market-info">
        <Link to={`/product/${p.id}`} className="line-clamp-2 min-h-8 text-small font-medium leading-tight text-ink hover:underline">{p.name}</Link>
        <p className="mt-1 truncate text-micro uppercase tracking-wide text-ink-faint">{p.sub}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-small font-bold ${p.was ? 'text-sale' : ''}`}>{money(p.price)}</span>
          {p.was && <span className="text-micro text-ink-faint line-through">{money(p.was)}</span>}
        </div>
        {!soldOut && p.stock < 10 && <p className="mt-1 text-micro text-ink-soft">Only {p.stock} left</p>}
        <div className="mt-auto pt-2">
          {soldOut ? (
            <button disabled className="market-quick cursor-not-allowed opacity-50">Sold out</button>
          ) : needsSize ? (
            <Link to={`/product/${p.id}`} className="market-quick flex items-center justify-center">Choose size</Link>
          ) : (
            <button onClick={quickAdd} className="market-quick market-add-quick flex items-center justify-center gap-2"><Plus className="h-3 w-3" /> Add to cart</button>
          )}
        </div>
      </div>
    </article>
  );
}
