import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Pills } from '../components/ui.jsx';
import { Query } from '../components/Async.jsx';
import { useCart } from '../cart.jsx';
import { money } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

const reviews = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n);

function Top({ p }) {
  const { add } = useCart();
  const toast = useToast();
  const needsSize = p.sizes.length > 0;
  return (
    <article className="card mb-gutter grid overflow-hidden md:grid-cols-2">
      <Link to={`/product/${p.id}`} className="relative">
        <ProductImage product={p} className="h-full min-h-[320px] w-full" size="h-28 w-28" tone="bg-stone" />
        <span className="absolute left-4 top-4 rounded-sm bg-ink px-3 py-1 text-micro font-medium text-white">#1 overall</span>
      </Link>
      <div className="flex flex-col justify-center p-8">
        <h2 className="text-display-sm">{p.name}</h2>
        <p className="mt-2 text-body text-ink-soft">{p.description || p.sub}</p>
        <p className="mt-4 flex items-center gap-1 text-small"><Star className="h-4 w-4 fill-ink" /> {p.rating} <span className="text-ink-soft">({reviews(p.reviews)} reviews)</span></p>
        <p className="mt-4 text-display-sm">{money(p.price)}</p>
        {needsSize || p.stock === 0 ? (
          <Link to={`/product/${p.id}`} className="btn-primary mt-6 w-max">{p.stock === 0 ? 'View product' : 'Choose size'}</Link>
        ) : (
          <button className="btn-primary mt-6 w-max active:bg-white active:text-ink" onClick={() => { add({ productId: p.id }); toast.show(`${p.name} added to your cart`, { to: '/cart', label: 'View cart' }); }}>Add to cart</button>
        )}
      </div>
    </article>
  );
}

export default function BestSellers() {
  const [cat, setCat] = useState('');
  const cats = trpc.catalog.categories.useQuery();
  const list = trpc.catalog.products.list.useQuery({ sort: 'featured', category: cat || undefined, limit: 13 });

  return (
    <Page title="Best sellers" intro="The most sought-after gear, ranked by what shoppers actually buy.">
      <div className="mb-8">
        <Pills value={cat} onChange={setCat} options={[{ value: '', label: 'All categories' }, ...(cats.data ?? []).filter((c) => c.count > 0).map((c) => ({ value: c.slug, label: c.name }))]} />
      </div>
      <Query q={list}>
        {(d) => {
          const [top, ...rest] = d.items;
          if (!top) return <p className="card p-10 text-center text-ink-soft">No best sellers in this category yet.</p>;
          return (
            <>
              <Top p={top} />
              <ProductGrid q={{ data: { items: rest, total: rest.length }, isLoading: false }} ranked={false} />
            </>
          );
        }}
      </Query>
    </Page>
  );
}
