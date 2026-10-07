import Stripe from 'stripe';
import { TRPCError } from '@trpc/server';
import { config } from '../config.js';
import { db } from '../db.js';
import { toKes, type OrderRow } from '../models.js';
import { failPayment, getOrder, markPaid } from './settlement.js';

/* ---------------------------------- M-Pesa ---------------------------------- */

const mpesaBase = () =>
  config.mpesa.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

/** Accepts 07xx, 01xx, 2547xx, +2547xx. Returns 2547XXXXXXXX or null. */
export function normalizeKePhone(input: string): string | null {
  const m = input.replace(/[\s-]/g, '').match(/^(?:\+?254|0)?([17]\d{8})$/);
  return m ? `254${m[1]}` : null;
}

export const kesAmount = (totalCents: number) => Math.max(1, toKes(totalCents));

async function mpesaToken() {
  const basic = Buffer.from(`${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`).toString('base64');
  const res = await fetch(`${mpesaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const timestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const stkPassword = (ts: string) =>
  Buffer.from(`${config.mpesa.shortcode}${config.mpesa.passkey}${ts}`).toString('base64');

async function stkPush(phone: string, amountKes: number, reference: string) {
  const token = await mpesaToken();
  const ts = timestamp();
  const res = await fetch(`${mpesaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: config.mpesa.shortcode,
      Password: stkPassword(ts),
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amountKes,
      PartyA: phone,
      PartyB: config.mpesa.shortcode,
      PhoneNumber: phone,
      CallBackURL: config.mpesa.callbackUrl,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: `M16DRIPKICKS ${reference}`.slice(0, 13),
    }),
  });
  const data = (await res.json()) as { ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string; ResponseDescription?: string };
  if (!res.ok || data.ResponseCode !== '0' || !data.CheckoutRequestID) {
    throw new Error(data.errorMessage || data.ResponseDescription || 'M-Pesa request was rejected');
  }
  return data.CheckoutRequestID;
}

/** Returns 'paid' | 'failed' | 'pending' by asking Daraja about the STK request. */
async function stkQuery(checkoutRequestId: string): Promise<'paid' | 'failed' | 'pending'> {
  const token = await mpesaToken();
  const ts = timestamp();
  const res = await fetch(`${mpesaBase()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: config.mpesa.shortcode,
      Password: stkPassword(ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { ResultCode?: string | number };
  if (data.ResultCode === undefined) return 'pending'; // Daraja answers with an error body while the prompt is still open
  return String(data.ResultCode) === '0' ? 'paid' : 'failed';
}

function simulateMpesa(order: OrderRow, phone: string) {
  // Demo mode: a phone ending in 0000 simulates a cancelled prompt, anything else pays.
  setTimeout(() => {
    const completion = phone.endsWith('0000')
      ? failPayment(order.code, 'M-Pesa request was cancelled on the phone.')
      : markPaid(order.code, `SIM-${order.code}`, `SIM${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
    void completion.catch((error) => console.error('[payments] demo M-Pesa settlement failed:', error));
  }, config.mpesa.simDelayMs).unref?.();
}

export async function startMpesa(order: OrderRow, rawPhone: string) {
  const phone = normalizeKePhone(rawPhone);
  if (!phone) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter a valid Safaricom number, for example 0712 345 678.' });
  if (!config.mpesa.live) {
    await db.query('UPDATE orders SET payment_ref = $1 WHERE id = $2', [`SIM-${order.code}`, order.id]);
    simulateMpesa(order, phone);
    return { mode: 'demo' as const };
  }
  const id = await stkPush(phone, kesAmount(order.total_cents), order.code);
  await db.query('UPDATE orders SET payment_ref = $1 WHERE id = $2', [id, order.id]);
  return { mode: 'live' as const };
}

/* ----------------------------------- Stripe ----------------------------------- */

let stripeClient: Stripe | null = null;
const stripe = () => (stripeClient ??= new Stripe(config.stripe.secretKey));
export const stripeEnabled = () => config.stripe.enabled;

export async function startCard(order: OrderRow, itemSummary: string) {
  if (!config.stripe.enabled) {
    // Demo mode: no card details are collected and nothing is charged.
    await markPaid(order.code, `SIM-CARD-${order.code}`);
    return { mode: 'demo' as const, url: null };
  }
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: order.email,
    client_reference_id: order.code,
    metadata: { orderCode: order.code },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: order.total_cents,
        product_data: { name: `M16DRIPKICKS order ${order.code}`, description: itemSummary.slice(0, 500) },
      },
    }],
    success_url: `${config.appUrl}/orders/${order.code}?placed=1`,
    cancel_url: `${config.appUrl}/checkout?cancelled=1`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  await db.query('UPDATE orders SET payment_ref = $1 WHERE id = $2', [session.id, order.id]);
  return { mode: 'live' as const, url: session.url };
}

export async function handleStripeEvent(rawBody: Buffer, signature: string | undefined) {
  if (!config.stripe.enabled || !config.stripe.webhookSecret || !signature) throw new Error('Stripe webhook is not configured');
  const event = stripe().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  const code = (event.data.object as { metadata?: { orderCode?: string } }).metadata?.orderCode;
  if (!code) return;
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status === 'paid') await markPaid(code, s.id);
  }
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    await failPayment(code, 'Card payment was not completed.');
  }
}

/* ------------------------------ Payment refresh ------------------------------ */

/**
 * Re-checks an unpaid order with the payment provider. Called when the customer opens the order
 * so the page still resolves if a webhook or callback never reached this server (e.g. local dev).
 */
export async function refreshPayment(order: OrderRow, receipt?: string) {
  if (order.payment_status !== 'unpaid' || order.status !== 'pending' || !order.payment_ref) return;
  try {
    if (order.payment_method === 'card' && config.stripe.enabled && order.payment_ref.startsWith('cs_')) {
      const s = await stripe().checkout.sessions.retrieve(order.payment_ref);
      if (s.payment_status === 'paid') await markPaid(order.code, s.id);
      else if (s.status === 'expired') await failPayment(order.code, 'Card payment was not completed.');
    }
    if (order.payment_method === 'mpesa' && config.mpesa.live && !order.payment_ref.startsWith('SIM-')) {
      const state = await stkQuery(order.payment_ref);
      if (state === 'paid') await markPaid(order.code, undefined, receipt);
      if (state === 'failed') await failPayment(order.code, 'M-Pesa payment was cancelled or failed.');
    }
  } catch (e) {
    console.warn(`[payments] refresh failed for ${order.code}:`, (e as Error).message);
  }
}

export async function handleMpesaCallback(body: unknown) {
  const cb = (body as { Body?: { stkCallback?: { CheckoutRequestID?: string; CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] } } } })?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return;
  const result = await db.query<{ code: string }>('SELECT code FROM orders WHERE payment_ref = $1', [cb.CheckoutRequestID]);
  const row = result.rows[0];
  if (!row) return;
  const order = await getOrder(row.code);
  if (!order) return;
  const receipt = cb.CallbackMetadata?.Item?.find((i) => i.Name === 'MpesaReceiptNumber')?.Value;
  // The callback is unauthenticated, so confirm with Daraja before trusting it.
  await refreshPayment(order, receipt ? String(receipt) : undefined);
}
