const kesFormat = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
export const money = (n) => `KSh ${kesFormat.format(Math.round(n ?? 0))}`;
export const kes = money;
export const date = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const dateTime = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const errMsg = (e) => e?.message || 'Something went wrong. Please try again.';
export const fieldErrors = (e) => e?.data?.fieldErrors || {};

export const STATUS = {
  pending: 'Awaiting payment',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
export const PAYMENT = { card: 'Card', mpesa: 'M-Pesa', cod: 'Cash on delivery' };
export const PAYMENT_STATUS = { unpaid: 'Unpaid', paid: 'Paid', cod: 'Pay on delivery', failed: 'Not paid', refund_due: 'Refund due' };
