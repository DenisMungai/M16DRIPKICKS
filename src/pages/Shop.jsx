import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import { Empty } from '../components/Async.jsx';
import { trpc } from '../trpc.ts';

const SORTS = [
  ['featured', 'Featured'], ['newest', 'Newest'], ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'], ['popular', 'Most reviewed'], ['discount', 'Biggest discount'],
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const brand = params.get('brand') ?? '';
  const sort = params.get('sort') ?? 'featured';
  const [limit, setLimit] = useState(24);
  const cats = trpc.catalog.categories.useQuery();

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
    setLimit(24);
  };

  const list = trpc.catalog.products.list.useQuery({
    q: q || undefined, category: category || undefined, brand: brand || undefined, sort, limit,
  });

  const total = list.data?.total;

  return (
    <Page wide>
      <div className="market-page -mx-4 sm:-mx-5 md:-mx-[4vw]">
        <aside className="market-filters" aria-label="Shop filters">
          <div className="mb-5 border-b border-line pb-4">
            <p className="mb-3 text-small font-semibold">Categories</p>
            <nav className="flex flex-col gap-1" aria-label="Product categories">
              <button
                onClick={() => set('category', '')}
                className={`rounded-sm px-2 py-2 text-left text-small ${category ? 'text-ink-soft hover:bg-stone' : 'bg-stone font-medium text-ink'}`}
              >
                All products
              </button>
              {(cats.data ?? []).filter((c) => c.count > 0).map((c) => (
                <button
                  key={c.slug}
                  onClick={() => set('category', c.slug)}
                  className={`rounded-sm px-2 py-2 text-left text-small ${category === c.slug ? 'bg-stone font-medium text-ink' : 'text-ink-soft hover:bg-stone'}`}
                >
                  {c.name}
                </button>
              ))}
            </nav>
          </div>
          <p className="text-micro leading-relaxed text-ink-soft">Choose a category to narrow the products shown.</p>
        </aside>

        <div className="market-results">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:hidden">
            <label className="flex items-center gap-2 text-small text-ink-soft">
              Category
              <select value={category} onChange={(e) => set('category', e.target.value)} className="max-w-[190px] rounded border border-line bg-card px-2 py-2 text-small text-ink">
                <option value="">All products</option>
                {(cats.data ?? []).filter((c) => c.count > 0).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="market-toolbar mb-4">
            <span className="text-ink-soft">{total ?? '—'} products</span>
            <label className="ml-auto flex items-center gap-2 text-ink-soft">
              Sort by
              <select value={sort} onChange={(e) => set('sort', e.target.value === 'featured' ? '' : e.target.value)} aria-label="Sort products">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <ProductGrid
            q={list}
            showDiscount
            cols="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
            onMore={() => setLimit(limit + 24)}
            empty={<Empty title="No products found">Try a different search, or <button className="underline" onClick={() => setParams({}, { replace: true })}>clear all filters</button>.</Empty>}
          />
        </div>
      </div>
    </Page>
  );
}
