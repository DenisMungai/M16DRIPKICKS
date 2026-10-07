import { useState } from 'react';
import { X } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import { Empty } from '../components/Async.jsx';
import { trpc } from '../trpc.ts';

const discounts = [
  { id: '50', label: '50% off or more', filter: { minDiscount: 50 } },
  { id: '30', label: '30% – 49% off', filter: { minDiscount: 30, maxDiscount: 50 } },
  { id: '29', label: 'Up to 29% off', filter: { maxDiscount: 30 } },
];
const sizes = ['7', '8', '9', '10', '11', '12', 'S', 'M', 'L', 'XL'];
const sorts = { discount: 'Highest discount', price_asc: 'Price: low to high', price_desc: 'Price: high to low', newest: 'Newest markdowns' };

export default function Deals() {
  const [cats, setCats] = useState([]);
  const [disc, setDisc] = useState(null);
  const [size, setSize] = useState(null);
  const [sort, setSort] = useState('discount');
  const [limit, setLimit] = useState(9);
  const categories = trpc.catalog.categories.useQuery();

  const list = trpc.catalog.products.list.useQuery({
    onSale: true, sort, limit,
    categories: cats.length ? cats : undefined,
    size: size ?? undefined,
    ...(discounts.find((d) => d.id === disc)?.filter ?? {}),
  });

  const toggle = (slug) => { setCats((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug])); setLimit(9); };
  const nameOf = (slug) => categories.data?.find((c) => c.slug === slug)?.name ?? slug;
  const reset = () => { setCats([]); setDisc(null); setSize(null); setLimit(9); };

  return (
    <Page title="Clearance" intro="End-of-season prices on the gear you already wanted. Sizes are limited." wide>
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-8" aria-label="Filters">
          <fieldset>
            <legend className="mb-3 text-title">Category</legend>
            <div className="space-y-2">
              {(categories.data ?? []).filter((c) => c.count > 0).map((c) => (
                <label key={c.slug} className="flex cursor-pointer items-center gap-3 text-small">
                  <input type="checkbox" checked={cats.includes(c.slug)} onChange={() => toggle(c.slug)} className="h-4 w-4 accent-black" />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="border-t border-line pt-6">
            <fieldset>
              <legend className="mb-3 text-title">Discount</legend>
              <div className="space-y-2">
                {discounts.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-3 text-small">
                    <input type="radio" name="disc" checked={disc === d.id} onChange={() => { setDisc(d.id); setLimit(9); }} className="h-4 w-4 accent-black" />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="border-t border-line pt-6">
            <fieldset>
              <legend className="mb-3 text-title">Size</legend>
              <div className="grid grid-cols-4 gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSize(size === s ? null : s); setLimit(9); }}
                    aria-pressed={size === s}
                    className={`border py-2 text-small transition-colors ${size === s ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </aside>

        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button key={c} onClick={() => toggle(c)} className="flex items-center gap-2 rounded-full bg-stone px-3 py-1.5 text-micro font-medium">{nameOf(c)} <X className="h-3 w-3" /></button>
              ))}
              {disc && <button onClick={() => setDisc(null)} className="flex items-center gap-2 rounded-full bg-stone px-3 py-1.5 text-micro font-medium">{discounts.find((d) => d.id === disc).label} <X className="h-3 w-3" /></button>}
              {size && <button onClick={() => setSize(null)} className="flex items-center gap-2 rounded-full bg-stone px-3 py-1.5 text-micro font-medium">Size {size} <X className="h-3 w-3" /></button>}
            </div>
            <label className="flex items-center gap-2 text-small text-ink-soft">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-line bg-card py-2 pl-3 pr-8 text-small font-medium text-ink">
                {Object.entries(sorts).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <ProductGrid
            q={list}
            onMore={() => setLimit(limit + 9)}
            empty={<Empty title="No deals match these filters"><button className="underline" onClick={reset}>Clear all filters</button> to see more.</Empty>}
          />
        </section>
      </div>
    </Page>
  );
}
