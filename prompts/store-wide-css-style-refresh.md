# Store-wide CSS style refresh

## Goal

Adapt the complete M16DRIPKICKS store UI to the visual language of the user-provided CSS snapshot: compact Poppins typography, a restrained white/light-gray/black palette, thin borders, precise spacing, understated controls, and responsive marketplace product layouts. Apply the visual system across shopper, account, checkout, and admin routes while preserving existing behavior.

## Skills read

- No applicable project skill was available for this React/Vite styling task.
- No workspace `AGENTS.md` file was found.

## Existing code inspected

- User-provided read-only CSS snapshot: global rules, header and promo strip, homepage hero, marketplace filters/results, product cards, detail page, and responsive breakpoints.
- `src/index.css` and `tailwind.config.js`: current Poppins import, colors, typography and spacing tokens.
- `src/App.jsx` and `src/components/Layout.jsx`: shared routing and shell.
- `src/components/Header.jsx`, `Sidebar.jsx`, `Footer.jsx`, `Page.jsx`, `ProductCard.jsx`, `ProductGrid.jsx`, `Field.jsx`, `ui.jsx`, `CartPanel.jsx`, `Modal.jsx`, and `AddressForm.jsx`: shared storefront and form components.
- Representative routes: `src/pages/Home.jsx`, `Shop.jsx`, `ProductDetail.jsx`, `Cart.jsx`, `Checkout.jsx`, `Login.jsx`, `Orders.jsx`, and `Admin.jsx`.
- `package.json`: available checks are `npm run typecheck`, `npm test`, and `npm run build`; no lint script is defined.

## Decisions or assumptions

- Treat the pasted CSS as the design reference, not as drop-in CSS: its class selectors do not match this application's component markup.
- Cover every route, including public shopping, authentication, account, order, checkout, and admin screens.
- Use the existing Poppins font and preserve the current mostly neutral palette, refining it to match the sample's `#f7f7f7` canvas, white surfaces, near-black text, and subtle gray borders.
- Adapt the persistent sidebar/header shell to the reference's compact horizontal storefront header while retaining clear access to all existing customer and admin navigation, especially on mobile.
- Use the reference marketplace's narrow filter rail and dense product grid where appropriate on catalog routes; do not force that catalog layout onto checkout, account, or admin pages.
- Keep React state, API calls, routing, accessibility semantics, and business logic unchanged unless a minimal markup adjustment is required to support the design.
- Do not modify the supplied CSS snapshot.

## Files likely to change

- `src/index.css`
- `tailwind.config.js`
- `src/components/Layout.jsx`
- `src/components/Header.jsx`
- `src/components/Sidebar.jsx`
- `src/components/Footer.jsx`
- Shared presentation components: `Page.jsx`, `ProductCard.jsx`, `ProductGrid.jsx`, `Field.jsx`, `ui.jsx`, `CartPanel.jsx`, `Modal.jsx`, and `AddressForm.jsx`, as needed.
- Shopper routes: `Home.jsx`, `Shop.jsx`, `Categories.jsx`, `Deals.jsx`, `NewArrivals.jsx`, `BestSellers.jsx`, `Brands.jsx`, `Collections.jsx`, and `ProductDetail.jsx`, as needed.
- Account/order/checkout/help routes and admin routes only where shared tokens/components are not sufficient to meet the design consistently.

## Implementation requirements

1. Establish a coherent shared design system matching the reference:
   - Poppins typography with compact but readable sizes and tight heading tracking.
   - Soft gray page canvas, white content surfaces, near-black primary actions, muted secondary text, and fine gray dividers.
   - Compact buttons, pills, fields, menus, cards, tables, dialogs, and status labels; reduce excessive rounded corners and decorative elevation.
   - Preserve visible focus states, disabled states, and reduced-motion behavior.
2. Refine the global shell toward the reference's sticky horizontal header, simple brand mark, search, utility/account/cart actions, and compact promotional strip. Make all existing customer/admin destinations discoverable and keep mobile navigation usable.
3. Give catalog routes the reference marketplace hierarchy: compact filter rail where viewport permits, clear results heading/tool row, responsive multi-column product cards, square/near-square media, understated image framing, and compact metadata/action controls.
4. Restyle the homepage hero, section headings, category controls, and product rows to match the same restrained visual language while preserving its current content and data.
5. Apply the shared presentation consistently to product details, cart, checkout, login/register, saved addresses, settings, order history/detail, help, and admin/dashboard/inventory/order screens. Keep dense admin tables usable with their existing horizontal overflow behavior on small screens.
6. Retain responsive behavior and adapt breakpoints to avoid horizontal overflow. Ensure mobile navigation, forms, product grids, dialogs, filters, and tables remain operable.
7. Prefer existing Tailwind utilities and shared components; introduce narrowly scoped CSS only when needed for the reference-specific marketplace layout.
8. Preserve all route paths, text/data, product availability, cart and checkout interactions, account flows, admin actions, and server/API behavior. Do not add packages or implement unrelated product features.

## Security requirements

- Styling-only scope: do not read, expose, change, or embed environment secrets or credentials.
- Do not modify authentication, authorization, API requests, server behavior, storage, or customer/order data.
- Do not introduce third-party scripts, fonts, network calls, or dependencies; use the already bundled Poppins font.
- Preserve semantic controls, labels, keyboard focus visibility, and disabled/error states.

## Acceptance criteria

- Every page uses a cohesive Poppins-based neutral visual style consistent with the supplied CSS snapshot.
- The overall shell no longer feels like the current oversized permanent-sidebar dashboard; the compact horizontal header remains fully navigable at desktop and mobile widths.
- Product browsing pages have the reference's denser, clean marketplace presentation, with responsive filters and product cards.
- Homepage, product detail, account, checkout, order, help, and admin pages are visibly restyled without losing route-specific usability.
- Existing data, content, actions, authentication, cart, checkout, filters, and admin workflows continue to behave as before.
- There is no unintended horizontal page overflow at mobile or desktop sizes, and focus/reduced-motion affordances remain usable.
- `npm run typecheck`, `npm test`, and `npm run build` pass.

## Checks to run

- `npm run typecheck`
- `npm test`
- `npm run build`
- Inspect the running app at desktop and mobile viewport widths, including the home page, catalog, product detail, checkout/account, and admin screens.

## Exact manual test steps expected after implementation

1. Run `npm run dev` from the project root and open `http://localhost:5173/`.
2. At a desktop viewport, compare the shared header, typography, spacing, colors, hero, and product cards with the provided CSS reference; use the header to visit the shop and an admin screen.
3. At a narrow mobile viewport, verify the menu opens and closes, all navigation destinations remain available, the product grid reflows, and no page-level horizontal scrollbar appears.
4. Open `/shop`, use a category/filter and sort control, open a product, and verify its image, options, quantity, wishlist, and add-to-cart controls still work.
5. Visit `/cart`, `/checkout`, `/login`, and an order/account page; verify fields, buttons, validation/error states, and responsive layouts remain usable.
6. Sign in with an existing admin account and inspect `/admin`, `/admin/inventory`, and `/admin/orders`; verify dashboard controls, tables, and admin navigation remain usable at desktop and mobile widths.
7. Run the automated checks listed above and confirm they pass.
