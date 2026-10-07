# M16DRIPKICKS storefront refresh

## Goal

Replace generic NovaShop storefront branding and marketing copy with the supplied M16DRIPKICKS store identity, make its selling points and contact locations visible to shoppers, use an existing product photo in the homepage hero, and make the M16 catalog available for purchase instead of marking every product sold out.

## Skills read

- No applicable project skill was available for this React/Express storefront task.
- No root `AGENTS.md` file was present.

## Existing code inspected

- `src/pages/Home.jsx`: homepage hero and catalog sections.
- `src/components/Sidebar.jsx`, `src/components/Footer.jsx`, and `src/pages/Help.jsx`: shared branding, footer links, and customer-facing store information.
- `src/components/ProductCard.jsx`: sold-out display is driven by product stock.
- `server/catalog.ts`: M16 catalog items, current product copy, and brand name.
- `server/seed.ts`: catalog upsert currently inserts all products with stock set to zero and does not update stock for existing catalog items.
- `server/routers/catalog.ts`: public catalog queries return active products without filtering on stock.
- `public/products/m16drip/`: existing product photos suitable for the homepage.
- `package.json`: available checks are `npm run typecheck`, `npm test`, and `npm run build`.

## Decisions and assumptions

- Use the store name exactly as `M16DRIPKICKS` in customer-facing branding.
- Present the supplied statements as concise, straightforward store information, without adding unsupported claims or generic AI-style marketing phrases.
- Use the existing `/products/m16drip/white-air-style-runners.jpg` product image in the homepage hero; do not add or download a new image.
- Initialize M16 products with 10 units of stock when seeding. When refreshing the M16 catalog, restore zero-stock M16 rows to that starting quantity while preserving any positive inventory counts.
- Preserve order history, accounts, and unrelated database records; do not run a full database reset.
- Present phone numbers as call links and show both supplied locations clearly. Use the user's 12-hour delivery statement as provided.

## Files likely to change

- `src/pages/Home.jsx`
- `src/components/Sidebar.jsx`
- `src/components/Footer.jsx`
- `src/pages/Help.jsx`
- `src/pages/Login.jsx`
- `index.html`
- `server/catalog.ts`
- `server/seed.ts`

## Implementation requirements

1. Replace customer-facing NovaShop branding and generic placeholder slogans with M16DRIPKICKS.
2. Replace the homepage hero's generic marketing text with the supplied store identity and benefits; display an existing catalog product photo responsively.
3. Add the supplied value propositions, delivery statement, flexible-pricing note, quality commitment, customer-satisfaction statement, and both locations/contact numbers in appropriate storefront locations.
4. Ensure contact numbers use `tel:` links and keep responsive layouts usable on mobile and desktop.
5. Keep catalog/product descriptions direct and factual; remove generic, unsupported marketing claims without changing the actual products or inventing product attributes.
6. Set seeded M16 products to an available starting stock of 10 and ensure an explicit catalog refresh corrects zero-stock M16 entries without wiping positive inventory, order history, or unrelated records.
7. Preserve existing cart, checkout, and product behavior apart from making the corrected positive stock purchasable.

## Security requirements

- Do not add secrets or new external service dependencies.
- Do not expose or modify customer/order information.
- Do not reset the database or overwrite positive inventory during catalog refresh.
- Use the existing local product image rather than a remote image source.

## Acceptance criteria

- The storefront visibly identifies itself as M16DRIPKICKS rather than NovaShop.
- The homepage shows an existing M16 product image and the supplied store messaging.
- Both locations and both phone numbers are easy to find and phone links work on supported devices.
- The homepage and shared storefront surfaces no longer contain generic NovaShop/AI-style promotional copy.
- Newly seeded M16 products have positive stock; refreshing the catalog restores zero-stock M16 items while preserving positive stock.
- Products with positive stock no longer display as sold out and can be added to the cart.
- Type checking, tests, and the production build pass.

## Checks to run

- `npm run typecheck`
- `npm test`
- `npm run build`

## Exact manual test steps

1. Run `npm run db:catalog` to refresh the current M16 catalog without resetting accounts or order history.
2. Run `npm run dev` and open `http://localhost:5173/`.
3. Confirm the homepage shows M16DRIPKICKS, the supplied store details, and an existing product photo at desktop and mobile widths.
4. Open a product card and confirm it is available rather than sold out; add it to the cart and confirm it appears there.
5. Check the footer/help information for both locations and tap/click each phone number on a device that supports `tel:` links.
