# Remove demo orders and dashboard figures

## Goal

Remove generated demo order history from PostgreSQL and ensure the admin dashboard and orders page show only real order activity, while preserving accounts, product records, and inventory.

## Skills read

- No applicable project skill was available for this Express/tRPC/PostgreSQL maintenance task.
- No project `AGENTS.md` was found.

## Existing code inspected

- `server/routers/admin.ts`: dashboard revenue/order/customer totals, chart, category trends, recent orders, and admin orders query.
- `src/pages/Admin.jsx`: dashboard cards, sales chart, trending categories, and existing empty states.
- `src/pages/AdminOrders.jsx`: orders list and existing empty state.
- `server/seed.ts`: generated sample order records use `payment_ref` values beginning with `SEED-`.
- PostgreSQL metadata-only check: 93 orders are marked `SEED-%`, 0 are non-seed orders, with 170 order-item rows; 29 products are active and all have stock; 11 user accounts exist.
- Existing test setup uses isolated `pg-mem`; the configured `.env` values were not displayed.

## Decisions or assumptions

- The user explicitly authorized permanent deletion of all 93 currently seeded demo orders and their 170 order items while preserving products, inventory, and all accounts.
- The database identifies generated demo orders by the seed-only `payment_ref LIKE 'SEED-%'` marker.
- Preserve non-seeded orders if any exist at execution time. Do not use `TRUNCATE`, delete users, delete products, adjust stock, or run reset seeding.
- Dashboard customers should mean customers with at least one real, non-seeded order, so retained demo-only accounts do not appear as real customer activity.
- Seeded orders should be omitted from admin order/dashboard queries as an additional safeguard.

## Files likely to change

- `server/routers/admin.ts`
- A narrow helper and command under `server/` for transactional removal of seed-marked orders.
- `package.json`
- `server/tests/api.test.ts` or a focused maintenance test file.
- `README.md`

## Implementation requirements

1. Add an explicit, narrowly scoped command (for example, `npm run db:remove-demo-orders`) that removes only rows whose `payment_ref LIKE 'SEED-%'`.
2. Run the operation transactionally. Delete orders and rely on the existing `ON DELETE CASCADE` for their order items.
3. Preserve every user/account, product/inventory row and stock quantity, and all orders not carrying the seed marker.
4. Print only aggregate counts (deleted demo orders and their order items); do not print customer data or environment values.
5. Exclude seeded orders from admin order listing and all dashboard revenue, order, chart, trending, recent, and customer-with-orders calculations.
6. Keep existing empty states for no recent orders and no trending sales.
7. Add tests proving seed-marked orders and their items are removed, real orders/items/users/products/stock are preserved, and admin dashboard/order queries contain no demo records.
8. Document the command and its narrow, destructive scope; explicitly warn against `npm run db:seed`, which resets the database.

## Security and data-safety requirements

- Never print or inspect the raw database URL or other `.env` secrets.
- Use parameterized SQL for values.
- Never run reset/truncate seeding.
- If any real non-seed records exist, preserve them.
- Do not delete accounts, catalog rows, or change inventory stock.

## Acceptance criteria

- All and only seed-marked orders and their dependent line items are deleted.
- All account, product, and stock rows remain unchanged.
- Dashboard and admin orders display only non-seeded real records and show empty states where there is no real activity.
- The maintenance command is explicit and safe to re-run.
- `npm run typecheck` and `npm test` pass.

## Checks to run

- `npm run typecheck`
- `npm test`
- Run the cleanup command against the configured PostgreSQL database only after review and verify aggregate counts plus preservation of accounts, products, and stock.

## Exact manual test steps

1. Confirm the project-root `.env` has `DATABASE_URL`; do not print or share its value.
2. Back up the PostgreSQL database before cleanup.
3. Run `npm run db:remove-demo-orders`; inspect the aggregate result only.
4. Verify the dashboard's sales/order/customer activity no longer includes seeded demo records.
5. Verify the admin Orders page shows only real, non-seeded orders (or its empty state).
6. Verify existing administrator/customer accounts and the 29 active M16DRIPKICKS products with their stock remain present.
