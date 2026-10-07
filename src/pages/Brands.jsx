import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Query } from '../components/Async.jsx';
import { money } from '../format.js';
import { trpc } from '../trpc.ts';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function Brands() {
  const [letter, setLetter] = useState(null);
  const [q, setQ] = useState('');
  const brands = trpc.catalog.brands.useQuery();
  const present = useMemo(() => new Set((brands.data ?? []).map((b) => b.name[0].toUpperCase())), [brands.data]);

  return (
    <Page title="Brands directory" intro="A curated selection of premium sportswear and athletic apparel partners." wide>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by letter">
          {letters.map((l) => (
            <button key={l} disabled={!present.has(l)} onClick={() => setLetter(letter === l ? null : l)} aria-pressed={letter === l}
              className={`h-9 w-9 text-small font-medium transition-colors disabled:text-ink-faint/60 ${letter === l ? 'bg-ink text-white' : 'enabled:hover:bg-stone'}`}>{l}</button>
          ))}
        </div>
        <label className="relative">
          <span className="sr-only">Search brands</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands" className="w-64 rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-small focus:border-ink focus:outline-none" />
        </label>
      </div>

      <Query q={brands}>
        {(all) => {
          const list = all.filter((b) => (!letter || b.name[0].toUpperCase() === letter) && b.name.toLowerCase().includes(q.toLowerCase()));
          if (!list.length) return <p className="card p-10 text-center text-ink-soft">No brands match. Try a different letter or search.</p>;
          return (
            <div className="space-y-gutter">
              {list.map((b) => (
                <section key={b.id} className="card grid gap-8 p-8 lg:grid-cols-[1fr_1.4fr]">
                  <div className="flex flex-col justify-between">
                    <div>
                      <p className="text-small text-ink-soft">{b.count} product{b.count === 1 ? '' : 's'}</p>
                      <h2 className="mt-1 text-display-sm">{b.name}</h2>
                      <p className="mt-3 max-w-md text-body text-ink-soft">{b.blurb}</p>
                    </div>
                    <Link to={`/shop?brand=${encodeURIComponent(b.name)}`} className="btn-primary mt-6 w-max">{b.cta} <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {b.top.map((p) => (
                      <Link key={p.id} to={`/product/${p.id}`} className="group">
                        <ProductImage product={p} className="aspect-square w-full rounded-lg" />
                        <p className="mt-2 truncate text-small font-medium group-hover:underline">{p.name}</p>
                        <p className="text-small text-ink-soft">{money(p.price)}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          );
        }}
      </Query>
    </Page>
  );
}
