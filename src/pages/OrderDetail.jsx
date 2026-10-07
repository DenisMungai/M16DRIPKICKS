import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Printer } from 'lucide-react';
import Page from '../components/Page.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { ErrorBox, Loading } from '../components/Async.jsx';
import { PENDING_KEY } from './Checkout.jsx';
import { useCart } from '../cart.jsx';
import { dateTime, errMsg, money, PAYMENT, PAYMENT_STATUS } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

const STEPS = ['pending', 'processing', 'shipped', 'delivered'];
const STEP_LABEL = { pending: 'Order placed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered' };

export default function OrderDetail() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { add, clear, setCoupon } = useCart();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.orders.byCode.useQuery({ code }, {
    refetchInterval: (query) => {
      const o = query.state.data;
      return o && o.status === 'pending' && o.paymentStatus === 'unpaid' ? 3000 : false;
    },
  });
  const cancel = trpc.orders.cancel.useMutation({
    onSuccess: () => { utils.orders.invalidate(); toast.show('Order cancelled'); },
    onError: (e) => toast.show(errMsg(e)),
  });
  const o = q.data;

  // The cart is only emptied once the order is actually confirmed, so a failed payment can be retried.
  useEffect(() => {
    if (o && (o.paymentStatus === 'paid' || o.paymentStatus === 'cod') && sessionStorage.getItem(PENDING_KEY) === o.code) {
      sessionStorage.removeItem(PENDING_KEY);
      clear();
      setCoupon('');
    }
  }, [o, clear, setCoupon]);

  if (q.isLoading) return <Page><Loading /></Page>;
  if (q.error) return <Page title="Order not found"><ErrorBox error={q.error} /><Link to="/orders" className="btn-primary mt-6">Back to my orders</Link></Page>;

  const waiting = o.status === 'pending' && o.paymentStatus === 'unpaid';
  const failed = o.status === 'cancelled' && (o.paymentStatus === 'failed' || o.paymentStatus === 'unpaid');
  const placed = params.get('placed') === '1' || o.status === 'processing';
  const step = STEPS.indexOf(o.status);
  const canCancel = !['shipped', 'delivered', 'cancelled'].includes(o.status) && o.paymentStatus !== 'paid';

  const retry = () => {
    o.items.forEach((i) => add({ productId: i.productId, qty: i.qty, size: i.size, color: i.color }));
    nav('/checkout');
  };

  let heading = `Order ${o.code}`;
  let sub = `Placed ${dateTime(o.createdAt)}`;
  if (waiting) {
    heading = o.paymentMethod === 'mpesa' ? 'Check your phone to pay' : 'Waiting for your payment';
    sub = o.paymentMethod === 'mpesa' ? 'Enter your M-Pesa PIN on the prompt we just sent. This page updates by itself.' : 'We are confirming your payment. This page updates by itself.';
  } else if (failed) {
    heading = 'Payment was not completed';
    sub = 'You have not been charged and the items were released. Your cart is still saved so you can try again.';
  } else if (placed && params.get('placed') === '1') {
    heading = 'Thank you, your order is in';
    sub = `We will email ${o.email} as your order moves. Order number ${o.code}.`;
  }

  return (
    <Page wide>
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center text-center">
          {!waiting && !failed && <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white"><Check className="h-7 w-7" /></span>}
          {waiting && <span className="mb-5 h-10 w-10 animate-spin rounded-full border-4 border-line border-t-ink" aria-hidden />}
          <h1 className="text-display-sm" aria-live="polite">{heading}</h1>
          <p className="mt-2 max-w-xl text-body text-ink-soft">{sub}</p>
          {failed && <button onClick={retry} className="btn-primary mt-6">Try again</button>}
        </div>

        {!failed && o.status !== 'cancelled' && (
          <ol className="card mt-10 grid grid-cols-4 gap-2 p-6 text-center text-micro" aria-label="Order progress">
            {STEPS.map((s, i) => (
              <li key={s} className={i <= step ? 'font-semibold text-ink' : 'text-ink-faint'}>
                <span className={`mx-auto mb-2 block h-2 rounded-full ${i <= step ? 'bg-ink' : 'bg-stone'}`} />
                {STEP_LABEL[s]}
              </li>
            ))}
          </ol>
        )}

        <section className="card mt-gutter p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title">Items</h2>
            <StatusBadge status={o.status} />
          </div>
          <ul className="space-y-4">
            {o.items.map((i, k) => (
              <li key={k} className="flex items-center gap-4">
                <ProductImage product={i} className="h-16 w-16 shrink-0 rounded-md" size="h-6 w-6" />
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${i.productId}`} className="block truncate text-small font-medium hover:underline">{i.name}</Link>
                  <p className="text-micro text-ink-soft">{[i.size && `Size ${i.size}`, i.color, `Qty ${i.qty}`].filter(Boolean).join(' · ')}</p>
                </div>
                <p className="text-small font-semibold">{money(i.price * i.qty)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-small">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
            {o.discount > 0 && <div className="flex justify-between"><dt className="text-ink-soft">Discount {o.couponCode && `(${o.couponCode})`}</dt><dd className="text-sale">-{money(o.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-soft">{o.shippingMethod === 'express' ? 'Express delivery' : 'Standard delivery'}</dt><dd>{o.shipping ? money(o.shipping) : 'Free'}</dd></div>
            <div className="flex justify-between pt-2 text-title"><dt>Total</dt><dd>{money(o.total)}</dd></div>
          </dl>
        </section>

        <section className="card mt-gutter grid gap-6 p-6 text-small sm:grid-cols-2">
          <div>
            <p className="text-ink-soft">Delivering to</p>
            <p className="mt-1 font-medium">{o.shipName}</p>
            <p>{o.shipLine}</p>
            <p>{o.shipCity}, {o.shipCountry}</p>
            <p>{o.shipPhone}</p>
          </div>
          <div>
            <p className="text-ink-soft">Payment</p>
            <p className="mt-1 font-medium">{PAYMENT[o.paymentMethod]} · {PAYMENT_STATUS[o.paymentStatus]}</p>
            {o.mpesaReceipt && <p>Receipt {o.mpesaReceipt}</p>}
            {o.tracking && <><p className="mt-4 text-ink-soft">Tracking number</p><p className="mt-1 font-medium">{o.tracking}</p></>}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
          <Link to="/orders" className="btn-primary">All my orders</Link>
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" /> Print invoice</button>
          {canCancel && <button onClick={() => window.confirm('Cancel this order?') && cancel.mutate({ code: o.code })} className="btn-secondary" disabled={cancel.isPending}>Cancel order</button>}
        </div>
        {o.paymentStatus === 'refund_due' && <p className="mt-4 text-center text-small text-ink-soft">Your refund is being processed by our team.</p>}
      </div>
    </Page>
  );
}
