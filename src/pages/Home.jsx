import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import CartPanel from '../components/CartPanel.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import { Query } from '../components/Async.jsx';
import { useCart } from '../cart.jsx';
import { categoryIcons } from '../data/nav.js';
import { ShoppingBag } from 'lucide-react';
import { trpc } from '../trpc.ts';

function Row({ title, to, items }) {
  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-title">{title}</h2>
        <Link to={to} className="text-small font-medium underline-offset-4 hover:underline">View all</Link>
      </div>
      <ProductGrid q={{ data: items, isLoading: false }} cols="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" />
    </section>
  );
}

export default function Home() {
  const { open, lines } = useCart();
  const cats = trpc.catalog.categories.useQuery();
  const home = trpc.catalog.home.useQuery();
  const benefits = [
    ['Competitive pricing', 'Favourable prices on all products.'],
    ['Quality apparel and footwear', 'Affordable outfits and sneakers made with quality in mind.'],
    ['Nationwide delivery', 'Fast delivery across Kenya within 12 hours.'],
    ['Flexible pricing', 'No fixed prices—contact us to discuss a better deal.'],
    ['Quality first', 'Quality is our priority.'],
    ['Customer satisfaction', 'Your satisfaction is our top concern.'],
  ];

  return (
    <main className="mx-auto flex max-w-page flex-col gap-gutter px-4 pb-8 pt-6 sm:px-5 md:px-page-x lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-16">
        <section className="home-hero flex min-h-[400px] flex-col-reverse overflow-hidden rounded-xl border border-line bg-card sm:flex-row">
          <div className="home-hero-copy flex flex-1 flex-col justify-center p-7 sm:p-10 lg:p-12">
            <span className="mb-4 w-max rounded-sm bg-ink px-3 py-1 text-micro font-medium text-white">M16DRIPKICKS</span>
            <h1 className="mb-4 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-display">Quality outfits and sneakers</h1>
            <p className="mb-8 max-w-md text-body text-ink-soft">Affordable apparel and footwear, with nationwide delivery within 12 hours.</p>
            <Link to="/shop" className="btn-primary w-max">Shop now <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="home-hero-image h-56 w-full bg-stone sm:h-auto sm:w-[48%]">
            <img
              src="/products/m16drip/white-air-style-runners.jpg"
              alt="White Air-Style Runners from M16DRIPKICKS"
              loading="eager"
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        <section aria-labelledby="cat-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="cat-heading" className="text-title">Shop by category</h2>
            <Link to="/categories" className="text-small font-medium underline-offset-4 hover:underline">View all</Link>
          </div>
          <Query q={cats}>
            {(list) => (
              <ul className="hide-scrollbar flex snap-x gap-gutter overflow-x-auto pb-4">
                {list.filter((c) => c.count > 0).map((c) => {
                  const Icon = categoryIcons[c.slug] ?? ShoppingBag;
                  return (
                    <li key={c.slug} className="snap-start">
                      <Link to={`/shop?category=${c.slug}`} className="group flex min-w-[96px] flex-col items-center gap-3">
                        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-card transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                          <Icon className="h-7 w-7" strokeWidth={1.5} />
                        </span>
                        <span className="text-center text-small font-medium">{c.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Query>
        </section>

        <Query q={home}>
          {(h) => (
            <>
              <Row title="New arrivals" to="/new-arrivals" items={{ items: h.newArrivals, total: h.newArrivals.length }} />
              <Row title="Best sellers" to="/best-sellers" items={{ items: h.bestSellers, total: h.bestSellers.length }} />
              <Row title="Deals" to="/deals" items={{ items: h.deals, total: h.deals.length }} />
              <section aria-labelledby="store-benefits-heading">
                <h2 id="store-benefits-heading" className="mb-4 text-title">Why shop with M16DRIPKICKS?</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {benefits.map(([title, description]) => (
                    <article key={title} className="rounded-xl border border-line bg-card p-5">
                      <h3 className="text-body font-semibold">{title}</h3>
                      <p className="mt-2 text-small text-ink-soft">{description}</p>
                    </article>
                  ))}
                </div>
                <p className="mt-4 text-small text-ink-soft">You’ve come to the right place for fashion.</p>
              </section>
            </>
          )}
        </Query>
      </div>

      {open && lines.length > 0 && <CartPanel />}
    </main>
  );
}
