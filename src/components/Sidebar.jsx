import { NavLink } from 'react-router-dom';
import { ShoppingBag, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { mainNav, accountNav, adminNav } from '../data/nav.js';

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-small font-medium transition-colors ${
    isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-stone hover:text-ink'
  }`;

export default function Sidebar({ open = false, onClose }) {
  const { user } = useAuth();
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink/40 xl:hidden" onClick={onClose} aria-hidden />}
      <aside className={`fixed left-0 top-0 z-50 h-full w-sidebar max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-card py-6 print:hidden xl:hidden ${open ? 'flex' : 'hidden'}`}>
        <button onClick={onClose} aria-label="Close menu" className="absolute right-4 top-4 xl:hidden"><X className="h-5 w-5" /></button>
        <NavLink to="/" onClick={onClose} className="mb-6 flex items-center gap-3 px-5">
          <ShoppingBag className="h-9 w-9" strokeWidth={1.75} />
          <span>
            <span className="block text-title font-bold leading-none tracking-tight">M16DRIPKICKS</span>
            <span className="mt-1 block text-micro text-ink-faint">Apparel and footwear</span>
          </span>
        </NavLink>

        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main">
          {mainNav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={linkClass}>
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              {badge && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">{badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 px-3">
          <hr className="my-4 border-line" />
          <nav className="flex flex-col gap-1" aria-label="Account">
            {accountNav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={onClose} className={linkClass}>
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </nav>

          {user?.role === 'admin' && (
            <>
              <hr className="my-4 border-line" />
              <nav className="flex flex-col gap-1" aria-label="Store admin">
                {adminNav.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={onClose} className={linkClass}>
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </>
          )}

          <NavLink to="/deals" onClick={onClose} className="mt-6 block rounded-md bg-mist p-4 transition-colors hover:bg-stone">
            <p className="text-micro text-ink-soft">Nationwide delivery</p>
            <p className="mt-1 text-title">Within 12 hours</p>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
