import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Page from '../components/Page.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Empty, Query } from '../components/Async.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { useCart } from '../cart.jsx';
import { date, money, PAYMENT_STATUS } from '../format.js';
import { trpc } from '../trpc.ts';

const tabs = [
  { id: 'all', label: 'All orders', test: () => true },
  { id: 'active', label: 'In progress', test: (o) => ['pending', 'processing', 'shipped'].includes(o.status) },
  { id: 'delivered', label: 'Delivered', test: (o) => o.status === 'delivered' },
  { id: 'cancelled', label: 'Cancelled', test: (o) => o.status === 'cancelled' },
];

export default function Orders() {
  const [tab, setTab] = useState('all');
  const orders = trpc.orders.list.useQuery({ limit: 100 });
  const { add } = useCart();
  const nav = useNavigate();

  const buyAgain = (o) => {
    o.items.forEach((i) => add({ productId: i.productId, qty: i.qty, size: i.size, color: i.color }));
    nav('/cart');
  };

  return (
    <Page title="Order history" intro="Manage and track your recent purchases.">
      <div className="mb-8 flex gap-6 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-small font-medium transition-colors ${tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}>{t.label}</button>
        ))}
      </div>

      <Query q={orders}>
        {(all) => {
          const list = all.filter(tabs.find((t) => t.id === tab).test);
          if (!list.length) {
            return <Empty title={all.length ? 'No orders in this view' : 'No orders yet'}>{!all.length && <Link to="/new-arrivals" className="btn-primary mt-4">Start shopping</Link>}</Empty>;
          }
          return (
            <div className="space-y-gutter">
              {list.map((o) => (
                <article key={o.code} className="card overflow-hidden">
                  <header className="flex flex-wrap items-center gap-x-12 gap-y-3 border-b border-line bg-mist px-6 py-4 text-small">
                    <div><p className="text-ink-soft">Order placed</p><p className="font-medium">{date(o.createdAt)}</p></div>
                    <div><p className="text-ink-soft">Total</p><p className="font-medium">{money(o.total)}</p></div>
                    <div><p className="text-ink-soft">Order #</p><p className="font-medium">{o.code}</p></div>
                    <div className="ml-auto flex items-center gap-3"><span className="text-micro text-ink-soft">{PAYMENT_STATUS[o.paymentStatus]}</span><StatusBadge status={o.status} /></div>
                  </header>
                  <div className="flex flex-wrap items-center gap-6 p-6">
                    <div className="flex -space-x-3">
                      {o.items.slice(0, 3).map((i, k) => <ProductImage key={k} product={i} className="h-16 w-16 rounded-lg border-2 border-card" size="h-6 w-6" />)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-title">{o.items[0]?.name}{o.items.length > 1 && <span className="text-ink-soft"> +{o.items.length - 1} more</span>}</p>
                      <p className="text-small text-ink-soft">{o.items.reduce((n, i) => n + i.qty, 0)} item(s){o.tracking && <> · Tracking {o.tracking}</>}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link to={`/orders/${o.code}`} className="btn-primary py-3">{o.status === 'pending' ? 'Complete payment' : 'View order'}</Link>
                      <button onClick={() => buyAgain(o)} className="btn-secondary py-3">Buy again</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          );
        }}
      </Query>
    </Page>
  );
}
