export default function Field({ label, error, hint, className = '', as: As = 'input', children, ...rest }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-small font-medium">{label}</span>
      <As
        aria-invalid={!!error}
        className={`w-full border bg-card px-4 py-3 text-small focus:border-ink focus:outline-none ${error ? 'border-sale' : 'border-line'}`}
        {...rest}
      >
        {children}
      </As>
      {hint && !error && <span className="mt-1 block text-micro text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-micro text-sale">{error}</span>}
    </label>
  );
}
