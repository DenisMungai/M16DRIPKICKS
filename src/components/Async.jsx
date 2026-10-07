export function Loading({ label = 'Loading' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-small text-ink-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorBox({ error, retry }) {
  return (
    <div role="alert" className="card p-8 text-center">
      <p className="text-title">We could not load this</p>
      <p className="mt-1 text-small text-ink-soft">{error?.message || 'Something went wrong.'}</p>
      {retry && <button onClick={() => retry()} className="btn-secondary mt-5 py-3">Try again</button>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-title">{title}</p>
      {children && <div className="mt-2 text-small text-ink-soft">{children}</div>}
    </div>
  );
}

/** Renders `children(data)` once the query has data. */
export function Query({ q, children }) {
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} retry={q.refetch} />;
  return children(q.data);
}
