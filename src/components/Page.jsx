export default function Page({ title, intro, actions, children, wide = false, compactTitle = false }) {
  return (
    <main className={`mx-auto px-4 pb-10 pt-8 sm:px-5 md:px-page-x ${wide ? 'max-w-page' : 'max-w-[1160px]'}`}>
      {title && (
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={compactTitle ? 'market-page-title' : 'text-display-sm'}>{title}</h1>
            {intro && <p className="mt-2 max-w-2xl text-body text-ink-soft">{intro}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </main>
  );
}
