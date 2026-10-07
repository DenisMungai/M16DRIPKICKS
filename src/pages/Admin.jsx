import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ShoppingCart, TrendingDown, TrendingUp, UserPlus } from 'lucide-react';
import Page from '../components/Page.jsx';
import { Query } from '../components/Async.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { date, money } from '../format.js';
import { trpc } from '../trpc.ts';

const RANGES = [['week', 'This week'], ['month', 'This month'], ['year', 'This year']];

function Delta({ d }) {
  if (d === null || d === undefined) return <span className="text-ink-soft">No data last month</span>;
  const up = d >= 0;
  return (
    <span className={`flex items-center gap-1 font-medium ${up ? '' : 'text-sale'}`}>
      {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{up ? '+' : ''}{d}% vs last month
    </span>
  );
}

export default function Admin() {
  const [range, setRange] = useState('week');
  const dash = trpc.admin.dashboard.useQuery({ range }, { placeholderData: (p) => p });

  return (
    <Page title="Dashboard overview" intro="Track your store's performance and recent activity." wide>
      <Query q={dash}>
        {(d) => {
          const max = Math.max(1, ...d.chart.values);
          const cards = [
            ['Total revenue', money(d.cards.revenue.value), d.cards.revenue.delta, CreditCard],
            ['Total orders', d.cards.orders.value.toLocaleString(), d.cards.orders.delta, ShoppingCart],
            ['Customers', d.cards.customers.value.toLocaleString(), d.cards.customers.delta, UserPlus],
          ];
          return (
            <>
              <div className="grid gap-gutter md:grid-cols-3">
                {cards.map(([label, value, delta, Icon]) => (
                  <div key={label} className="card p-6">
                    <div className="flex items-center justify-between text-small text-ink-soft">{label}<Icon className="h-5 w-5" strokeWidth={1.75} /></div>
                    <p className="mt-3 text-display-sm">{value}</p>
                    <p className="mt-2 text-small"><Delta d={delta} /></p>
                  </div>
                ))}
              </div>

              <div className="mt-gutter grid gap-gutter lg:grid-cols-[2fr_1fr]">
                <section className="card p-6">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-title">Sales performance</h2><p className="text-display-sm">{money(d.chart.total)}</p></div>
                    <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Range">
                      {RANGES.map(([r, l]) => <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`rounded-full px-4 py-1.5 text-small font-medium ${range === r ? 'bg-ink text-white' : 'text-ink-soft'}`}>{l}</button>)}
                    </div>
                  </div>
                  <div className="flex h-56 items-end gap-2" role="img" aria-label={`Paid sales for ${range}`}>
                    {d.chart.values.map((v, i) => (
                      <div key={`${d.chart.labels[i]}-${i}`} className="flex h-full flex-1 flex-col items-center gap-2">
                        <div className="flex w-full flex-1 items-end rounded-t-md bg-mist" title={money(v)}>
                          <div className="w-full rounded-t-md bg-ink" style={{ height: `${(v / max) * 100}%` }} />
                        </div>
                        <span className="text-micro text-ink-soft">{d.chart.labels[i]}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="card flex flex-col p-6">
                  <h2 className="mb-4 text-title">Trending categories</h2>
                  <ul className="flex-1 space-y-4">
                    {d.trending.length === 0 && <li className="text-small text-ink-soft">No sales in the last 30 days.</li>}
                    {d.trending.map((t) => (
                      <li key={t.name} className="flex items-center justify-between">
                        <div><p className="font-medium">{t.name}</p><p className="text-small text-ink-soft">{t.units} sold</p></div>
                        <span className={`text-small font-semibold ${t.delta !== null && t.delta < 0 ? 'text-sale' : ''}`}>{t.delta === null ? 'New' : `${t.delta > 0 ? '+' : ''}${t.delta}%`}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/admin/inventory" className="btn-secondary mt-6 py-3">Open inventory</Link>
                </section>
              </div>

              <section className="card mt-gutter overflow-hidden">
                <div className="flex items-center justify-between p-6"><h2 className="text-title">Recent sales</h2><Link to="/admin/orders" className="text-small font-medium hover:underline">View all</Link></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-small">
                    <thead className="bg-mist text-ink-soft"><tr>{['Product', 'Order ID', 'Date', 'Customer', 'Status', 'Amount'].map((h) => <th key={h} scope="col" className="px-6 py-3 font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {d.recent.map((r) => (
                        <tr key={r.code} className="border-t border-line">
                          <td className="px-6 py-4 font-medium">{r.product}</td>
                          <td className="px-6 py-4"><Link to={`/orders/${r.code}`} className="hover:underline">{r.code}</Link></td>
                          <td className="px-6 py-4">{date(r.createdAt)}</td>
                          <td className="px-6 py-4">{r.customer}</td>
                          <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                          <td className="px-6 py-4 font-semibold">{money(r.total)}</td>
                        </tr>
                      ))}
                      {d.recent.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-ink-soft">No orders yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          );
        }}
      </Query>
    </Page>
  );
}
