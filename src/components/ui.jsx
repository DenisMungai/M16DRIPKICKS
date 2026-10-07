import { STATUS } from '../format.js';

export function Pills({ options, value, onChange, label = 'Filter' }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full border px-4 py-2 text-small font-medium transition-colors ${value === o.value ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status, className = '' }) {
  const solid = status === 'delivered' || status === 'shipped';
  const muted = status === 'cancelled';
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-micro font-semibold ${solid ? 'bg-ink text-white' : muted ? 'bg-stone text-ink-soft' : 'border border-ink text-ink'} ${className}`}>
      {STATUS[status] ?? status}
    </span>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex gap-1" aria-label="Pagination">
      <button disabled={page === 1} onClick={() => onPage(page - 1)} className="px-3 py-1.5 text-small font-medium disabled:text-ink-faint">Prev</button>
      {Array.from({ length: pages }, (_, i) => (
        <button key={i} onClick={() => onPage(i + 1)} aria-current={page === i + 1 ? 'page' : undefined} className={`h-8 w-8 text-small font-medium ${page === i + 1 ? 'bg-ink text-white' : 'hover:bg-stone'}`}>{i + 1}</button>
      ))}
      <button disabled={page === pages} onClick={() => onPage(page + 1)} className="px-3 py-1.5 text-small font-medium disabled:text-ink-faint">Next</button>
    </nav>
  );
}
