import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import Page from '../components/Page.jsx';
import { Query } from '../components/Async.jsx';
import { categoryIcons } from '../data/nav.js';
import { trpc } from '../trpc.ts';

const tones = ['bg-stone', 'bg-mist', 'bg-card', 'bg-mist', 'bg-stone', 'bg-card', 'bg-mist'];

export default function Categories() {
  const cats = trpc.catalog.categories.useQuery();
  return (
    <Page title="Categories" intro="Browse our full range of performance gear, designed for athletes and built to last." wide>
      <Query q={cats}>
        {(list) => (
          <div className="grid auto-rows-[220px] gap-gutter sm:grid-cols-2 lg:grid-cols-4">
            {list.filter((c) => c.count > 0).map((c, i) => {
              const Icon = categoryIcons[c.slug] ?? ShoppingBag;
              return (
                <Link
                  key={c.slug}
                  to={`/shop?category=${c.slug}`}
                  className={`group card relative flex flex-col justify-between overflow-hidden p-6 ${tones[i % tones.length]} ${i === 0 ? 'sm:col-span-2 lg:row-span-2' : ''}`}
                >
                  <Icon className="h-10 w-10 text-ink-faint" strokeWidth={1.25} />
                  <div>
                    <h2 className="text-display-sm">{c.name}</h2>
                    <span className="mt-2 flex w-max items-center gap-2 text-small font-medium underline-offset-4 group-hover:underline">
                      {c.count} product{c.count === 1 ? '' : 's'} <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Query>
    </Page>
  );
}
