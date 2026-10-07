# Homepage placement, admin coupons, and product discounts

## Goal

Move the “Why shop with M16DRIPKICKS?” section to the bottom of the homepage, directly below the Deals section. Give administrators a secure way to create and manage coupons that customers can claim and redeem at checkout, and ensure product discounts are easy for administrators to set and are clearly shown on every product card.

## Skills read

- No applicable project skills were present: `.agents/skills/` was not found.
- The repository is Vite + React + Express/tRPC, not Next.js, so the Next.js documentation requirement does not apply.
- Existing project conventions were inspected in place of unavailable skills.

## Existing code inspected

- `src/pages/Home.jsx` — homepage section order and Deals row.
- `src/components/ProductCard.jsx` and `src/components/ProductGrid.jsx` — sale price and discount badge rendering.
- `src/pages/Inventory.jsx` — administrator product form, including current and original prices.
- `src/data/nav.js`, `src/App.jsx`, and `src/components/Sidebar.jsx` — admin navigation and route patterns.
- `server/routers/admin.ts` and `server/trpc.ts` — admin-only procedures and product create/update validation.
- `server/routers/account.ts`, `server/services/pricing.ts`, and `server/routers/catalog.ts` — coupon claim, checkout evaluation, and public product data.
- `server/migrations/001_initial.sql` and `server/models.ts` — existing coupon and product price fields.
- `server/tests/api.test.ts` — existing API integration test setup.
- `package.json` and `README.md` — available validation commands and application stack.

## Decisions and assumptions

- Keep the existing coupon types: percentage, fixed amount, and free shipping. Do not add coupon scope or usage-limit features beyond the fields already supported by the database.
- Add an admin coupons page that lists existing coupons and supports creation and activation/deactivation. Deactivation is preferred over deletion so coupon records and customer wallet references remain intact.
- Coupon codes will be normalized to uppercase and unique. New coupons are claimable by code using the existing customer wallet flow and redeemable through existing checkout pricing.
- `auto_grant` will default off. When enabled on creation, grant the coupon to existing users; retain the existing sign-up behavior that grants active auto-grant coupons to new users.
- Product discounts use the existing `price` as the discounted/current price and `was` as the previous price. No database migration is needed. An unset previous price means no active discount.
- Show percentage-off, previous price with strikethrough, and current price on product cards whenever a valid discount exists, not only in grids that opt into `showDiscount`.
- Do not read or expose `.env` values or introduce/modify secrets.

## Files likely to change

- `src/pages/Home.jsx`
- `src/components/ProductCard.jsx`
- `src/components/ProductGrid.jsx` if required to remove obsolete per-grid discount gating
- `src/pages/Inventory.jsx`
- `src/pages/AdminCoupons.jsx` (new)
- `src/data/nav.js`
- `src/App.jsx`
- `server/routers/admin.ts`
- `server/tests/api.test.ts`
- `prompts/admin-coupons-product-discounts-homepage.md` (this prompt)

## Implementation requirements

1. Reorder homepage sections so the Why shop section renders after the complete Deals row and is the last content section in the homepage content column.
2. Add an admin-only coupons route and navigation item using the existing `RequireAuth` and `adminProcedure` patterns.
3. Add admin tRPC procedures to list coupons, create coupons, and toggle active status. Validate all inputs with Zod on the server. Use parameterized SQL and the existing database transaction helper.
4. Coupon creation must support the existing coupon fields that affect customer use: code, tag, title, note, type, value, minimum spend, optional expiry, one-use-per-customer, auto-grant, and active status.
5. Validate coupon values by type: percentage must be in the supported range (1–100), fixed amount must be positive, and free shipping must not require a discount amount. Validate minimum spend and expiry inputs, and report duplicate codes cleanly.
6. For `auto_grant`, create wallet entries for existing users in the same transaction as coupon creation. Preserve the existing registration flow for future users. Coupon claiming, expiration/minimum-spend/one-per-user checks, and checkout redemption must continue to use existing server-side behavior.
7. The admin coupon interface must show coupon code, type/value, active status, and expiration/eligibility details; provide a clear creation form and activation/deactivation action; show pending and error states following existing admin form patterns.
8. Make the inventory product form’s sale-price intent clear: label the current price as the selling/discounted price and `was` as the previous price; explain that leaving the previous price empty removes the discount. Preserve server-side `was > price` validation.
9. Product cards must consistently show the discount percentage badge, the previous price crossed out, and the discounted price whenever the product has a valid markdown. Keep regular-price cards unchanged and preserve existing product card interactions.
10. Do not alter coupon checkout calculations, currency conversion, product storage schema, unrelated admin features, or other homepage sections.

## Security requirements

- Coupon create/list/activation endpoints must use `adminProcedure`; browser-side route protection alone is insufficient.
- Keep all validation and coupon pricing decisions server-side. Never trust client-submitted discounted totals.
- Use Zod validation, parameterized SQL, and transactions for creation plus auto-grant assignments.
- Do not expose credentials or read `.env` content.

## Acceptance criteria

- Homepage order ends with New arrivals, Best sellers, Deals, then Why shop with M16DRIPKICKS.
- A non-admin cannot use coupon administration endpoints or access the admin coupons page.
- An administrator can create each supported coupon type, see the created coupon in the list, and deactivate/reactivate it.
- A created active code can be claimed by a customer, appears in their coupon wallet, and can be applied in the cart/checkout according to existing rules.
- Auto-granted coupons appear in wallets for existing users and continue to be granted to newly registered users.
- Invalid values, duplicate codes, inactive codes, expired codes, minimum-spend failures, and one-use-per-customer behavior remain correctly rejected by server-side validation.
- An administrator can set a previous price higher than the discounted price and remove a product markdown by clearing the previous price.
- Every applicable product card displays the correct percentage, crossed-out previous price, and discounted price; products without discounts show no sale treatment.
- Existing API tests remain passing, and targeted tests cover admin coupon access, create/list/toggle behavior, auto-grant, validation, and product discount DTO output where practical.

## Checks to run

- `npm run typecheck`
- `npm run test`
- `npm run build`

## Exact manual test steps

1. Start the application with `npm run dev` and sign in as an administrator.
2. Open `/admin/inventory`, edit a product, set a discounted price and a larger previous price, save, and verify the product card shows its percentage badge, crossed-out previous price, and discounted price on the home page and shop listing.
3. Edit that product and clear its previous price; verify the card no longer shows a discount badge or crossed-out price.
4. Open `/admin/coupons`, create a percentage coupon with a future expiry, a minimum spend, and auto-grant disabled. Confirm it appears in the admin list.
5. Sign in as a customer, open `/coupons`, claim the new code, add products to the cart, apply the code, and verify the quote applies the expected discount only when eligible.
6. Deactivate the coupon in the admin page; verify it can no longer be claimed or redeemed. Reactivate it and verify normal use resumes.
7. Create an auto-grant coupon and verify it appears in the wallets of existing users; register a new customer and verify the existing sign-up grant behavior still applies.
8. Load `/` and verify that Deals is immediately followed by the Why shop with M16DRIPKICKS section at the bottom of the homepage content.
