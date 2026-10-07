# Add-to-cart button feedback

## Goal

Make every active “Add to cart” button appear black at rest, turn white while pressed, and return to black when released, without changing cart behavior.

## Skills read

- No applicable project skill is available for this React/Vite storefront task.
- No workspace `AGENTS.md` file was found.

## Existing code inspected

- `src/components/ProductCard.jsx`: quick-add control for product cards; it uses the shared `.market-quick` class.
- `src/pages/BestSellers.jsx`: featured best-seller add button; it uses `.btn-primary`.
- `src/pages/ProductDetail.jsx`: product detail add button; it uses `.btn-primary` and is disabled for sold-out products.
- `src/index.css`: shared `.market-quick` and `.btn-primary` styles, including their current colors and transitions.
- `package.json`: available checks are `npm run typecheck`, `npm test`, and `npm run build`; there is no lint script.

## Decisions or assumptions

- Apply the interaction to all three active “Add to cart” button locations so the same action behaves consistently throughout the storefront.
- Use the native pressed state (`:active`) for the white feedback; restore the existing black background as soon as the press ends. No persistent “added” state or timer is needed.
- Preserve the existing product-card button layout and all add-to-cart, toast, size-selection, and sold-out behavior.
- Leave non-add-to-cart buttons and disabled “Sold out” controls unchanged.

## Files likely to change

- `src/components/ProductCard.jsx`
- `src/pages/BestSellers.jsx`
- `src/pages/ProductDetail.jsx`
- `src/index.css`

## Implementation requirements

1. Keep active add-to-cart buttons black with white text at rest.
2. Change the background to white and text/icon to black only while pressed; restore the black background and white foreground when released.
3. Use existing styling patterns and transitions; do not add dependencies or introduce a persistent state/timer.
4. Preserve disabled styling for sold-out products and existing accessible focus-visible styling.
5. Do not alter cart mutations, quantity/size handling, toasts, routing, or unrelated button styles.

## Security requirements

- Do not inspect, display, change, or embed environment variables, secrets, or credentials.
- Do not add third-party scripts, services, network calls, or packages.

## Acceptance criteria

- Each active “Add to cart” button is black with white foreground at rest.
- Pressing any of the three buttons makes it white with dark foreground; releasing restores black.
- Existing cart updates and toast behavior continue to work.
- Product-card “Choose size” links and disabled “Sold out” controls retain their existing appearance and behavior.
- `npm run typecheck`, `npm test`, and `npm run build` pass.

## Checks to run

- `npm run typecheck`
- `npm test`
- `npm run build`

## Exact manual test steps expected after implementation

1. Run `npm run dev` and open `http://localhost:5173/`.
2. On `/shop`, press and release an in-stock product-card “Add to cart” button; verify it turns white only while pressed and returns to black, and verify the cart count/toast still updates.
3. On `/best-sellers`, repeat the press/release check for the featured product’s button.
4. On a product detail page for an in-stock item, repeat the press/release check; verify existing size selection, if required, and cart behavior remain unchanged.
5. Verify sold-out controls remain disabled and unchanged.
6. Run the automated checks listed above.
