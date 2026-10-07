# Replace demo products with M16 Drip catalog

## Goal

Replace NovaShop's fictional active product catalog with the distinct sellable products represented by the uploaded `M16Drip.zip` photos, and show all customer-facing prices in Kenyan shillings from KSh 3,000 to KSh 5,000.

## Skills read

- No listed project skill applies to this Vite/React and Express/SQLite catalog change.
- No `AGENTS.md` was present in the workspace.

## Existing code inspected

- `server/seed.ts`: fictional catalog, users, coupons, generated orders, reset and seed entry points.
- `server/models.ts`: product and order DTOs currently convert stored cents into USD.
- `server/config.ts`: `KES_PER_USD` is configurable and defaults to 129.
- `server/routers/catalog.ts`, `server/routers/admin.ts`, and `server/services/pricing.ts`: catalog reads, inventory writes, and quote/coupon amounts.
- `server/services/payments.ts`: M-Pesa converts stored USD cents to KSh; Stripe charges USD.
- `src/format.js` and product/cart/checkout/order/admin screens: shared currency formatting.
- `server/tests/api.test.ts` and `package.json`: catalog, pricing, and available test/build/typecheck commands.
- `M16Drip.zip`: 116 JPEGs. The image set contains footwear, boots, heels, casual shoes, and graphic tees; it also has repeated views/colorways, packing/delivery photos, and unrelated cleaner-product imagery. A sample and labeled contact sheets were inspected.

## Decisions or assumptions

- Follow the user's choice: create one listing per distinct sellable product, use a clear product photo as its primary image, group evident color variants where the current product model supports them, and skip incidental/non-catalog photos.
- Use generic, visually descriptive names and the M16 Drip store brand; do not invent product specifications, reviews, sales, stock history, or brand authenticity claims from photos.
- Assign sensible KSh prices within the requested inclusive KSh 3,000–5,000 range, rounded to practical amounts.
- Preserve the existing USD-minor-unit database/payment contract. Convert the KSh catalog prices to stored USD-equivalent values using `KES_PER_USD`, convert all displayed DTO money back to KSh consistently, keep M-Pesa conversion correct, and keep live Stripe amounts denominated in USD.
- Provide a separate repeatable catalog-refresh command. Do not use `db:seed`'s reset behavior or delete customer accounts, orders, wishlists, or historical order items. Deactivate old fictional products so they disappear from public catalog queries while preserving references required by existing history.

## Files likely to change

- `server/seed.ts` and `package.json` for catalog records and a non-destructive refresh command.
- `server/models.ts`, `server/services/pricing.ts`, and `server/routers/admin.ts` for currency-safe product, quote, order, coupon, and inventory DTOs.
- `src/format.js` and any directly related currency copy that currently assumes USD.
- `server/services/payments.ts` only if required to preserve the existing USD Stripe and KSh M-Pesa payment contracts.
- `server/tests/api.test.ts` for catalog, currency conversion, and non-destructive catalog refresh coverage.
- `public/products/m16drip/` for curated, locally served product photos extracted from the uploaded ZIP.

## Implementation requirements

- Curate images by visual product identity; map stable product SKUs to selected ZIP entries. Do not create one listing for every photo.
- Exclude packaging, delivery, store-sign, cleaning-spray, and other incidental photos. Copy only the selected sellable product photos into the project.
- Use safe deterministic filenames and public asset paths; do not preserve awkward WhatsApp filenames in application data.
- Seed only real catalog items from the ZIP. Do not generate fake ratings/reviews/sales or retain the fictional product list as active inventory.
- Make catalog refresh idempotent and non-destructive to users, orders, order items, coupons, and wishlists. Existing fictional product rows referenced by historical orders may be deactivated rather than deleted.
- Ensure seed/demo orders and wishlists do not reference removed fictional SKUs; if demo data remains enabled, adjust it to the curated catalog without resetting existing data.
- Keep displayed product prices, discounts, cart/checkout totals, order totals, and administrative product prices in KSh. Currency conversion must use configured `KES_PER_USD`, not a duplicated hard-coded exchange rate.
- Maintain correct underlying coupon arithmetic and payment provider values after conversion. Never multiply KSh-denominated values by the exchange rate twice.
- Preserve existing sizes/colors where supported and derive only what is clearly visible. Product price values must remain between KSh 3,000 and KSh 5,000.
- Keep the existing storefront layout and product interactions; this request changes catalog data and currency, not overall design.

## Security requirements

- Extract only expected JPEG file entries; reject archive paths outside the intended product asset directory and avoid path traversal.
- Do not execute archive contents, add dependencies, or expose credentials.
- Keep payment amounts computed server-side from authoritative catalog data.

## Acceptance criteria

- Public listing, home sections, brand/category pages, search, and product details show curated products from the ZIP; no fictional seeded product remains active.
- Every active catalog product has an existing local image path and a price in KSh 3,000–5,000.
- Color/size choices, cart, checkout, order history, admin inventory, and monetary summaries remain coherent in KSh.
- M-Pesa receives the correct KSh amount and Stripe retains its current USD-compatible amount.
- Re-running the catalog refresh does not duplicate products or remove accounts, orders, order items, or wishlists.
- Tests cover the catalog price range, image paths/product counts, amount conversions, and data-preserving refresh behavior.

## Checks to run

- `npm run typecheck`
- `npm test`
- `npm run build`
- Run the new catalog-refresh command against the local database and verify it preserves existing accounts and order counts.
- Inspect the home, shop, and product-detail pages in the browser, including at least one narrow viewport.

## Exact manual test steps expected after implementation

1. Run the non-destructive catalog refresh command printed in the implementation summary.
2. Run `npm run dev` and open the storefront home page.
3. Confirm the featured products use the uploaded photos and prices show `KSh` between 3,000 and 5,000.
4. Open `/shop`, filter/search, and open a product detail page; verify images, sizes/colors, and prices.
5. Add a product to cart, review cart and checkout totals, and confirm all amounts remain in KSh.
6. Check an existing account/order still exists and open admin inventory to confirm old fictional items are inactive and new items are available.
7. If payment-provider credentials are configured, verify the server-side M-Pesa/Stripe amount conversion in test mode; do not make a live charge.
