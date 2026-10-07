import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';

const collections = [
  { name: 'The Fall Drop', note: 'Structured pieces for cooler mornings', to: '/new-arrivals', tone: 'bg-stone' },
  { name: 'Clearance', note: 'End-of-season prices, limited sizes', to: '/deals', tone: 'bg-mist' },
  { name: 'Most Wanted', note: 'Ranked by what shoppers buy most', to: '/best-sellers', tone: 'bg-mist' },
  { name: 'Run Club', note: 'Road, track and trail essentials', to: '/shop?category=footwear', tone: 'bg-stone' },
];

export default function Collections() {
  return (
    <Page title="Collections" intro="Hand-picked edits across the store." wide>
      <div className="grid gap-gutter sm:grid-cols-2">
        {collections.map((c) => (
          <Link key={c.name} to={c.to} className={`group flex min-h-[260px] flex-col justify-end rounded-xl border border-line p-8 ${c.tone}`}>
            <h2 className="text-display-sm">{c.name}</h2>
            <p className="mt-2 text-body text-ink-soft group-hover:text-ink">{c.note}</p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
