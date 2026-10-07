import { useEffect, useRef, useState } from 'react';
import { Bell, Heart, LogOut, Menu, Search, ShoppingCart } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { dateTime, STATUS } from '../format.js';
import { accountNav, adminNav, mainNav } from '../data/nav.js';
import { trpc } from '../trpc.ts';

function useOutside(ref, onOutside) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOutside]);
}

const SEEN = 'novashop.alerts.seen';

function Alerts() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN) || '');
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const orders = trpc.orders.list.useQuery({ limit: 5 }, { refetchInterval: 60_000 });
  const list = orders.data ?? [];
  const unread = list.some((o) => o.updatedAt > seen);

  const toggle = () => {
    setOpen(!open);
    if (!open && list[0]) {
      const latest = list.reduce((m, o) => (o.updatedAt > m ? o.updatedAt : m), '');
      localStorage.setItem(SEEN, latest);
      setSeen(latest);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-expanded={open} aria-label="Order updates" className="relative flex flex-col items-center gap-1 text-ink-soft hover:text-ink">
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unread && <span className="absolute -right-0.5 top-0 h-2 w-2 rounded-full bg-ink lg:right-3" />}
        <span className="hidden text-micro lg:block">Alerts</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 rounded-xl border border-line bg-card p-2">
          <p className="px-3 py-2 text-small font-semibold">Order updates</p>
          {list.length === 0 && <p className="px-3 pb-3 text-small text-ink-soft">No orders yet. Updates on your orders will show here.</p>}
          {list.map((o) => (
            <Link key={o.code} to={`/orders/${o.code}`} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-mist">
              <p className="text-small font-medium">{o.code} · {STATUS[o.status]}</p>
              <p className="text-micro text-ink-soft">{o.items[0]?.name}{o.items.length > 1 ? ` +${o.items.length - 1} more` : ''} · {dateTime(o.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();
  const { logout } = useAuth();
  useOutside(ref, () => setOpen(false));
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-stone text-small font-semibold">{initials}</span>
        <span className="hidden text-left md:block">
          <span className="block text-small font-medium leading-4">{user.name}</span>
          <span className="text-micro text-ink-faint">{user.role === 'admin' ? 'Admin' : 'Profile'}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-56 rounded-lg border border-line bg-card p-2">
          {accountNav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-small hover:bg-mist">
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
          {user.role === 'admin' && (
            <>
              <div className="my-1 border-t border-line" />
              {adminNav.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-small hover:bg-mist">
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              ))}
            </>
          )}
          <button
            onClick={async () => { await logout.mutateAsync(); setOpen(false); nav('/'); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-small hover:bg-mist"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({ onMenu }) {
  const { count } = useCart();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');

  const searchFor = (value) => {
    const term = value.trim();
    nav(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop');
  };

  const submit = (e) => {
    e.preventDefault();
    const value = e.currentTarget.querySelector('input')?.value ?? q;
    searchFor(value);
  };

  const submitOnEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchFor(e.currentTarget.value);
    }
  };

  return (
    <>
      <div className="flex h-8 items-center justify-center bg-ink px-3 text-center text-micro font-medium text-white print:hidden">
        Quality apparel and footwear · Nationwide delivery across Kenya
      </div>
      <header className="sticky top-0 z-40 flex min-h-[66px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-card/95 px-3 pb-2 pt-2 backdrop-blur sm:px-5 xl:flex-nowrap xl:gap-x-7 xl:px-page-x xl:py-0 print:hidden">
        <button className="rounded-full p-2 hover:bg-mist xl:hidden" aria-label="Open menu" onClick={onMenu}><Menu className="h-5 w-5" /></button>

        <Link to="/" className="flex shrink-0 flex-col leading-none" aria-label="M16DRIPKICKS home">
          <span className="text-[15px] font-extrabold tracking-[-0.06em] sm:text-base">M16DRIPKICKS</span>
          <span className="mt-1 text-[9px] tracking-wide text-ink-soft">APPAREL &amp; FOOTWEAR</span>
        </Link>

        <nav className="market-header-nav hidden min-w-0 flex-1 items-center justify-center gap-4 2xl:gap-6 xl:flex" aria-label="Main">
          {mainNav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `whitespace-nowrap text-[10px] font-medium transition-colors 2xl:text-small ${isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <form role="search" className="relative order-last basis-full xl:order-none xl:block xl:basis-auto xl:max-w-[220px] xl:flex-1" onSubmit={submit}>
          <label className="relative block">
            <span className="sr-only">Search products</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)}
              aria-label="Search products"
              placeholder="Search products"
              onKeyDown={submitOnEnter}
              className="w-full rounded-full border border-line bg-mist py-2 pl-9 pr-10 text-small placeholder:text-ink-faint focus:border-ink focus:bg-card focus:outline-none"
            />
          </label>
          <button type="submit" onClick={(e) => { e.preventDefault(); searchFor(q); }} aria-label="Submit product search" className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-stone hover:text-ink">
            <Search className="h-4 w-4" />
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4 xl:gap-5">
          <Link to="/wishlist" className="flex flex-col items-center gap-0.5 text-ink-soft hover:text-ink" aria-label="Wishlist">
            <Heart className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden text-[9px] sm:block">Wishlist</span>
          </Link>
          {user && <Alerts />}
          <Link to="/cart" className="relative flex flex-col items-center gap-0.5 text-ink-soft hover:text-ink" aria-label={`Cart, ${count} items`}>
            <ShoppingCart className="h-4 w-4" strokeWidth={1.75} />
            {count > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-semibold text-white">{count}</span>
            )}
            <span className="hidden text-[9px] sm:block">Cart</span>
          </Link>
          <div className="hidden h-7 w-px bg-line sm:block" />
          {loading ? <span className="h-8 w-8" /> : user ? <ProfileMenu user={user} /> : (
            <Link to="/login" className="btn-primary min-h-9 px-3 py-2 text-small">Sign in</Link>
          )}
        </div>
      </header>
    </>
  );
}
