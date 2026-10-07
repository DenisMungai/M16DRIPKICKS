import ProductCard from './ProductCard.jsx';
import { Empty, Query } from './Async.jsx';

/** Renders a tRPC list query ({ items, total }) as a card grid with loading / error / empty states. */
export default function ProductGrid({ q, ranked = false, cols = 'sm:grid-cols-2 xl:grid-cols-3', empty, onMore }) {
  return (
    <Query q={q}>
      {(data) => {
        const items = data.items ?? data;
        if (!items.length) return empty ?? <Empty title="Nothing here yet">Try a different filter.</Empty>;
        return (
          <>
            <div className={`market-grid grid gap-3 sm:gap-4 ${cols}`}>
              {items.map((p, i) => <ProductCard key={p.id} product={p} rank={ranked ? i + 1 : undefined} />)}
            </div>
            {onMore && data.total > items.length && (
              <div className="mt-12 flex justify-center border-t border-line pt-8">
                <button className="btn-secondary" onClick={onMore}>Load more products</button>
              </div>
            )}
          </>
        );
      }}
    </Query>
  );
}
