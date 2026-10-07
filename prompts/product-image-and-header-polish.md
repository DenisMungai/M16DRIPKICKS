# Product image and header polish

## Goal

Fix inconsistent product imagery in product and brand cards, rename the product-card quick action to “Add to cart,” and make the navigation search field consistently usable with more breathing room between header contents.

## Skills read

- No applicable project skill is available for this React/Vite storefront task.
- No workspace `AGENTS.md` file was found.

## Existing code inspected

- `src/components/ProductImage.jsx`: shared product image wrapper currently uses `object-contain p-2`.
- `src/components/ProductCard.jsx`: product-card image frame, stock/size-specific controls, and “Quick add” action.
- `src/pages/Brands.jsx`: brand product image cards use the shared `ProductImage`.
- `src/components/Header.jsx`: search input currently appears only at `2xl`, while narrower layouts render a search link that navigates to `/shop` without opening a query field; search submission navigates to `/shop?q=...`.
- `src/components/ProductGrid.jsx`: shared product-card grid.
- `src/index.css`: shared market card and image styles.
- `src/components/WishlistButton.jsx`: card overlay control.
- `package.json`: checks are `npm run typecheck`, `npm test`, and `npm run build`; there is no lint script.

## Decisions or assumptions

- Restore the former product-photo rendering behavior (`object-cover`, no inner image padding) inside the existing square image frame, so cards and brand thumbnails fill a consistent uniform area.
- Keep `ProductImage` as the single shared image renderer, including its existing fallback placeholder behavior, so product cards and brand cards stay consistent.
- Keep the “Choose size” action for size-dependent products and “Sold out” for unavailable products; rename only the existing quick-add action to “Add to cart.”
- Make search genuinely available at narrow and wide widths. Use a responsive compact search presentation that preserves the existing `/shop?q=...` submit behavior without squeezing the brand and action controls.
- Increase horizontal spacing between header regions and main navigation links while keeping the mobile menu and all current navigation/account/cart actions available.
- Keep changes limited to presentation and header search interaction; do not change catalog data, routes, or cart behavior.

## Files likely to change

- `src/components/ProductImage.jsx`
- `src/components/ProductCard.jsx`
- `src/components/Header.jsx`
- `src/index.css`
- `src/pages/Brands.jsx` only if necessary to make brand thumbnail frames consistent.

## Implementation requirements

1. Render available product photos with the previous `object-cover` treatment and no internal padding, respecting each card’s existing square/aspect-ratio frame.
2. Ensure image containers clip overflowing media, fill their frame, and render missing-image placeholders consistently. Brand product thumbnails must use the same treatment as product cards.
3. Change the product-card quick-add button text to “Add to cart” without changing its stock/size handling, cart mutation, or toast behavior.
4. Provide a visible and functional product search field in navigation at mobile, tablet, and desktop widths. Submitting a non-empty query must navigate to `/shop?q=<encoded query>`; submitting an empty query may navigate to `/shop`.
5. Use appropriate responsive spacing between brand, navigation, search, wishlist, cart, and account controls; prevent overlap or horizontal page overflow at narrow widths.
6. Preserve accessible input labeling, keyboard submit, menu behavior, focus visibility, and all current routes.
7. Use existing dependencies and design tokens; do not alter unrelated store styling or application/server behavior.

## Security requirements

- Do not inspect, display, change, or embed environment variables, secrets, or credentials.
- Do not add third-party scripts, fonts, services, network calls, or packages.
- Keep search input handling client-side using the existing route navigation; do not add server-side search behavior or expose additional data.

## Acceptance criteria

- Product-card and brand-card image frames are uniform, and photos fill the frame using the previous `object-cover` appearance rather than varying inset sizes.
- Product image fallback placeholders remain visible and correctly sized when an image is missing.
- In-stock products without a size option show an “Add to cart” button and retain current cart/toast behavior.
- Sized products still prompt for size selection, and sold-out products remain disabled.
- Search is accessible from the navigation on narrow through wide screens and submits queries to the existing shop search route.
- Header items have more comfortable spacing, remain usable on mobile/desktop, and introduce no horizontal page overflow.
- `npm run typecheck`, `npm test`, and `npm run build` pass.

## Checks to run

- `npm run typecheck`
- `npm test`
- `npm run build`
- Browser-check product cards and brand cards at mobile and desktop sizes, plus search submission and cart action labels.

## Exact manual test steps expected after implementation

1. Run `npm run dev` and open `http://localhost:5173/`.
2. At mobile and desktop widths, open `/shop` and `/brands`; confirm product photos fill uniform square frames and missing-image placeholders remain centered.
3. On `/shop`, confirm an in-stock product with no required size displays “Add to cart”; click it and verify the cart count/toast updates. Confirm sized products still show “Choose size” and unavailable products remain disabled.
4. Use the navigation search input at mobile, tablet, and desktop widths; search for an existing product term and verify the browser navigates to `/shop?q=...` and shows matching results.
5. At narrow widths, verify navigation controls do not overlap and the page has no horizontal overflow.
6. Run all automated checks listed above.
