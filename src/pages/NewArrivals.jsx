import { useState } from 'react';
import Page from '../components/Page.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import { Pills } from '../components/ui.jsx';
import { trpc } from '../trpc.ts';

export default function NewArrivals() {
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState(12);
  const cats = trpc.catalog.categories.useQuery();
  const list = trpc.catalog.products.list.useQuery({ isNew: true, sort: 'newest', category: cat || undefined, limit });

  return (
    <Page title="New arrivals" intro="The fall drop: structured pieces built for momentum.">
      <div className="mb-8">
        <Pills value={cat} onChange={(v) => { setCat(v); setLimit(12); }} options={[{ value: '', label: 'All' }, ...(cats.data ?? []).filter((c) => c.count > 0).map((c) => ({ value: c.slug, label: c.name }))]} />
      </div>
      <ProductGrid q={list} onMore={() => setLimit(limit + 12)} />
    </Page>
  );
}
