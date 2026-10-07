import { keepPreviousData } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { trpc } from './trpc.ts';

const KEY = 'novashop.cart.v1';
export const lineKey = (l) => `${l.productId}|${l.size ?? ''}|${l.color ?? ''}`;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { lines: Array.isArray(s.lines) ? s.lines : [], coupon: typeof s.coupon === 'string' ? s.coupon : '' };
  } catch {
    return { lines: [], coupon: '' };
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [state, setState] = useState(load);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);

  // Keep several tabs in sync.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setState(load()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => {
    const lines = state.lines;
    return {
      lines,
      coupon: state.coupon,
      open,
      setOpen,
      count: lines.reduce((n, l) => n + l.qty, 0),
      add: ({ productId, qty = 1, size = null, color = null }) =>
        setState((s) => {
          const next = { productId, qty, size, color };
          const hit = s.lines.find((l) => lineKey(l) === lineKey(next));
          const lines = hit
            ? s.lines.map((l) => (lineKey(l) === lineKey(next) ? { ...l, qty: Math.min(10, l.qty + qty) } : l))
            : [...s.lines, next];
          return { ...s, lines };
        }),
      setQty: (key, qty) =>
        setState((s) => ({ ...s, lines: s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(1, Math.min(10, qty)) } : l)) })),
      remove: (key) => setState((s) => ({ ...s, lines: s.lines.filter((l) => lineKey(l) !== key) })),
      clear: () => setState((s) => ({ ...s, lines: [] })),
      setCoupon: (coupon) => setState((s) => ({ ...s, coupon: coupon.trim().toUpperCase() })),
    };
  }, [state, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

/** Prices, discounts, shipping and stock issues always come from the server. */
export function useQuote(shippingMethod = 'standard') {
  const { lines, coupon } = useCart();
  return trpc.checkout.quote.useQuery(
    {
      items: lines.map(({ productId, qty, size, color }) => ({ productId, qty, size, color })),
      couponCode: coupon || undefined,
      shippingMethod,
    },
    { enabled: lines.length > 0, placeholderData: keepPreviousData, staleTime: 0 },
  );
}
