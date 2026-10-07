# Migrate the store database to PostgreSQL

## Goal

Replace the store's SQLite runtime database with a PostgreSQL database configured through a server-only `DATABASE_URL`, and provide a safe one-time importer that copies all existing local SQLite store data into PostgreSQL.

## Skills read

- No applicable project skill was available for this Express/tRPC PostgreSQL migration.
- No root `AGENTS.md` file was present.

## Existing code inspected

- `server/db.ts`: synchronous `better-sqlite3` connection and inline schema for users, catalog, inventory, orders, payments, coupons, wishlists, and addresses.
- `server/models.ts`: shared row types and synchronous database-backed DTO/query helpers.
- Database call sites in `server/context.ts`, `server/seed.ts`, `server/routers/`, and `server/services/`.
- `server/tests/api.test.ts`: current tests use `DB_PATH=:memory:` and directly use synchronous SQLite helpers.
- `server/config.ts`, `.env.example`, `.gitignore`, `package.json`, and `README.md`.
- Existing database file location is configured locally by `DB_PATH`; do not read, print, copy, or commit `.env` secrets.

## Decisions and assumptions

- The target is a standard PostgreSQL database from a provider other than Supabase; use the provider's normal PostgreSQL connection string in `DATABASE_URL`.
- Use the `pg` Node.js driver and a server-only connection pool. Keep PostgreSQL credentials out of client bundles and logs.
- Preserve all tables and existing rows from the current SQLite store, including users/password hashes, catalog and stock, orders and order items, payment state, coupons, wishlists, and addresses.
- Add an explicit migration/import command. Do not silently upload local data, drop tables, or reset either database at application startup.
- Keep the source SQLite file intact after import. Import must run transactionally and fail explicitly on errors rather than reporting partial success.
- Use schema migrations for PostgreSQL and update seed behavior without re-seeding/resetting existing production data.
- Keep product image and upload files local; copying the database does not copy uploaded image files to hosting.

## Files likely to change

- `package.json`, `package-lock.json`
- `.env.example`
- `README.md`
- `server/config.ts`, `server/db.ts`, `server/models.ts`, `server/context.ts`
- `server/seed.ts` and `server/routers/` and `server/services/` database callers
- `server/tests/api.test.ts` and test setup
- New PostgreSQL schema/migration and SQLite-to-PostgreSQL import files under `server/`

## Implementation requirements

1. Add a server-only `DATABASE_URL` setting and configure a PostgreSQL pool. Fail clearly at startup if the URL is missing or the connection/schema is unavailable; do not silently fall back to SQLite.
2. Convert database access across the API, auth/session context, catalog, account, admin, order, payment-settlement, and seed paths from synchronous SQLite calls to awaited PostgreSQL calls. Keep route/business behavior and typed DTOs intact.
3. Translate SQLite SQL to PostgreSQL safely: use positional `$1` parameters, PostgreSQL identity/sequence handling, compatible conflict clauses, transaction handling, date handling, and `RETURNING` where insert IDs are needed.
4. Preserve concurrency and stock guarantees in pricing, order placement, payment completion/failure, cancellation/refunds, and settlement. Ensure multi-query changes use transactions and prevent overselling under concurrent checkouts.
5. Create versioned or otherwise repeatable PostgreSQL schema setup covering every current table, constraint, unique key, index, and foreign-key behavior. Do not run destructive schema changes on every start.
6. Provide an explicit command (for example, `npm run db:import-sqlite`) to import the configured local SQLite database into an initialized PostgreSQL database. Import all existing data in foreign-key order, preserve IDs and relationships, reset PostgreSQL identity sequences after import, and run atomically.
7. Make the import safe to retry or refuse to run if the destination already contains application data. Never delete/overwrite destination data automatically; print only counts and a clear success/failure result, not credentials or customer data.
8. Keep local file uploads available as configured; clearly document that database import does not transfer uploaded image files.
9. Replace `DB_PATH` as the runtime database setting with `DATABASE_URL`; retain a separate SQLite path/configuration only where needed by the explicit legacy importer.
10. Update `.env.example` and README with the database setup, where the user puts `DATABASE_URL` in root `.env`, provider connection-string guidance, SSL guidance when required by the provider, database initialization, one-time import order, and safe local/production run commands.
11. Adapt automated tests to cover catalog, auth, stock/inventory, orders/payments, and admin behavior against PostgreSQL-compatible access. Tests must use an isolated test database/schema or an in-memory PostgreSQL-compatible test adapter; never run destructive setup against the user's configured production database.
12. Add tests for importer data/relationship preservation, repeat-import refusal or safe retry semantics, sequence correctness, and failure rollback.

## Security requirements

- `DATABASE_URL` is server-only. Do not prefix it with `NEXT_PUBLIC_`, reference it in React/Vite client code, or expose it through API config.
- Do not read out, copy, log, or commit the user's `.env` value. Add only a blank placeholder to `.env.example`.
- Parameterize all user-controlled SQL values. Do not concatenate user input into query text.
- Protect password hashes and personal/order data during import; do not log imported rows.
- Never automatically erase source SQLite data or destination PostgreSQL data.

## Acceptance criteria

- The backend uses PostgreSQL, not SQLite, for every runtime read/write and requires `DATABASE_URL`.
- All current store features continue to typecheck and retain their behavior, including authentication, catalog search, inventory, checkout, stock reservation/restoration, payments, coupons, order history, and admin.
- An explicit import preserves existing row counts, IDs, foreign-key relationships, inventory, user credentials, orders, and related records, and leaves the source SQLite file unchanged.
- No partial import remains if the import fails; retry behavior is clearly safe and tested.
- The app does not start with a silent SQLite fallback and does not leak database credentials.
- Automated tests, typecheck, and production build pass.

## Checks to run

- `npm run typecheck`
- `npm test`
- `npm run build`
- PostgreSQL integration tests against a disposable test database/schema or PostgreSQL-compatible in-memory test adapter.

## Exact manual test steps

1. In the provider dashboard, create a PostgreSQL database and copy its PostgreSQL connection string without sharing it in chat.
2. Put the connection string in the project-root `.env` as `DATABASE_URL=...`; do not use a `NEXT_PUBLIC_` variable. Keep the existing `.env` private.
3. Back up the local SQLite file and uploads before migration.
4. Initialize the hosted database using the documented migration command.
5. Run the explicit SQLite import command against the existing local `DB_PATH`; verify imported table counts in the app/admin without printing customer data.
6. Confirm a second import is safely refused or safely idempotent, according to the documented behavior.
7. Run `npm run dev`; verify sign-in, catalog display, product stock, add-to-cart, order checkout in demo mode, and admin inventory/order views.
8. Deploy with the same server-only `DATABASE_URL` configured in the hosting provider's environment settings; never commit it or add it to browser-exposed configuration.
