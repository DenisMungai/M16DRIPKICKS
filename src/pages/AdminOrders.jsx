import { useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { Query } from '../components/Async.jsx';
import { Pager, Pills, StatusBadge } from '../components/ui.jsx';
import { dateTime, errMsg, money, PAYMENT, PAYMENT_STATUS, STATUS } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

const NEXT = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
const LABEL = { processing: 'Mark as processing', shipped: 'Mark as shipped', delivered: 'Mark as delivered', cancelled: 'Cancel order' };

function UpdateOrder({ order, onDone }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const [tracking, setTracking] = useState(order.tracking ?? '');
  const m = trpc.admin.orderUpdate.useMutation({
    onSuccess: () => { utils.admin.orders.invalidate(); utils.admin.dashboard.invalidate(); toast.show('Order updated'); onDone(); },
  });
  const options = NEXT[order.status];
  return (
    <div className="space-y-5 text-small">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="text-ink-soft">Customer</p><p className="font-medium">{order.shipName}</p><p>{order.email}</p><p>{order.shipPhone}</p></div>
        <div><p className="text-ink-soft">Deliver to</p><p>{order.shipLine}</p><p>{order.shipCity}, {order.shipCountry}</p></div>
      </div>
      <ul className="divide-y divide-line border-y border-line">
        {order.items.map((i, k) => <li key={k} className="flex justify-between py-2"><span>{i.qty} × {i.name}{i.size && ` · ${i.size}`}</span><span>{money(i.price * i.qty)}</span></li>)}
      </ul>
      <p>Payment: <span className="font-medium">{PAYMENT[order.paymentMethod]} · {PAYMENT_STATUS[order.paymentStatus]}</span>{order.mpesaReceipt && ` · ${order.mpesaReceipt}`}</p>
      {order.paymentStatus === 'refund_due' && <p className="rounded-lg border border-sale p-3 text-sale">This paid order was cancelled. Refund {money(order.total)} to the customer.</p>}
      {options.length > 0 && (
        <>
          {options.includes('shipped') && <Field label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} hint="Required before marking as shipped." />}
          {m.error && <p role="alert" className="text-sale">{errMsg(m.error)}</p>}
          <div className="flex flex-wrap gap-3">
            {options.map((s) => (
              <button key={s} disabled={m.isPending} className={s === 'cancelled' ? 'btn-secondary py-3' : 'btn-primary py-3'}
                onClick={() => (s !== 'cancelled' || window.confirm('Cancel this order and return the stock?')) && m.mutate({ code: order.code, status: s, tracking: tracking || null })}>{LABEL[s]}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminOrders() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const orders = trpc.admin.orders.useQuery({ status: status || undefined, page, pageSize: 10 }, { placeholderData: (p) => p });

  return (
    <Page title="Orders" intro="Review payments and move orders through fulfilment." wide>
      <div className="mb-6">
        <Pills label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: '', label: 'All' }, ...Object.entries(STATUS).map(([value, label]) => ({ value, label }))]} />
      </div>
      <Query q={orders}>
        {(d) => (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-small">
                <thead className="bg-mist text-ink-soft"><tr>{['Order', 'Placed', 'Customer', 'Payment', 'Total', 'Status', ''].map((h, i) => <th key={i} scope="col" className="px-6 py-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {d.items.map((o) => (
                    <tr key={o.code} className="border-t border-line">
                      <td className="px-6 py-4 font-medium"><Link to={`/orders/${o.code}`} className="hover:underline">{o.code}</Link></td>
                      <td className="px-6 py-4">{dateTime(o.createdAt)}</td>
                      <td className="px-6 py-4">{o.shipName}<span className="block text-micro text-ink-soft">{o.email}</span></td>
                      <td className="px-6 py-4">{PAYMENT[o.paymentMethod]}<span className="block text-micro text-ink-soft">{PAYMENT_STATUS[o.paymentStatus]}</span></td>
                      <td className="px-6 py-4 font-semibold">{money(o.total)}</td>
                      <td className="px-6 py-4"><StatusBadge status={o.status} /></td>
                      <td className="px-6 py-4"><button onClick={() => setOpen(o)} className="font-medium underline-offset-4 hover:underline">Manage</button></td>
                    </tr>
                  ))}
                  {d.items.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-ink-soft">No orders in this view.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-small">
              <p className="text-ink-soft">{d.total} order{d.total === 1 ? '' : 's'}</p>
              <Pager page={d.page} pages={d.pages} onPage={setPage} />
            </div>
          </div>
        )}
      </Query>
      {open && <Modal wide title={`Order ${open.code}`} onClose={() => setOpen(null)}><UpdateOrder order={open} onDone={() => setOpen(null)} /></Modal>}
    </Page>
  );
}
