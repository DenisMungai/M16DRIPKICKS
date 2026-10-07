import { Link } from 'react-router-dom';

const links = [
  ['Payment information', '/help/secure-payment'],
  ['Returns', '/help/returns'],
  ['Contact & locations', '/help/support'],
  ['Terms', '/help/terms'],
  ['Privacy', '/help/privacy'],
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-card print:hidden">
      <div className="mx-auto grid max-w-page gap-7 px-5 py-8 sm:grid-cols-2 md:px-page-x">
        <div>
          <p className="text-title font-bold tracking-tight">M16DRIPKICKS</p>
          <p className="mt-2 text-small text-ink-soft">Quality apparel and footwear. Fast delivery across Kenya within 12 hours.</p>
          <p className="mt-4 text-small font-semibold">Call or text</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-small">
            <a href="tel:0798489436" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">0798 489 436</a>
            <a href="tel:0769373616" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">0769 373 616</a>
          </div>
        </div>
        <div>
          <h2 className="text-small font-semibold">Visit us</h2>
          <p className="mt-2 text-small text-ink-soft">Kenyatta University Main Campus (KU), KM, along La Quita Supermarket.</p>
          <p className="mt-2 text-small text-ink-soft">Pick-up point: Nairobi CBD, Ronald Ngala Street, Royal Palm Mall, Wing B, BM39.</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2">
          {links.map(([label, to]) => (
            <li key={to}><Link to={to} className="text-small text-ink-soft hover:text-ink">{label}</Link></li>
          ))}
        </ul>
        <p className="text-small text-ink-soft sm:col-span-2">© {new Date().getFullYear()} M16DRIPKICKS.</p>
      </div>
    </footer>
  );
}
