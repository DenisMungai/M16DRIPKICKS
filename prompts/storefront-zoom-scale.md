# Reduce storefront visual scale

## Goal

Make the NovaShop storefront feel less zoomed by reducing the shared UI scale consistently across routes and screen sizes.

## Skills read

- No listed project skill applies to this styling-only change.
- No `AGENTS.md` was present in the workspace.

## Existing code inspected

- `src/index.css`: global base styles; the root currently inherits the browser's default 16px font size.
- `tailwind.config.js`: shared spacing tokens include pixel-based `gutter`, `sidebar`, and `page-x` values.
- `src/App.jsx` and `src/components/Layout.jsx`: routes share the same layout.
- `src/components/Header.jsx`, `src/components/ProductGrid.jsx`, `src/components/ProductCard.jsx`, and `src/pages/Home.jsx`: representative shared and page-level sizing.
- The running storefront at `http://localhost:5175/` appears oversized at its current 720 CSS-pixel viewport.
- `package.json`: available checks include `npm run typecheck`, `npm run build`, and `npm test`; no lint script is configured.

## Decisions or assumptions

- Interpret “reduce the zoom ratio” as reducing the site's shared CSS scale, not changing the visitor's browser zoom.
- Use a modest 90% root font-size so existing `rem`-based typography and dimensions scale together.
- Convert the custom shared pixel spacing tokens to equivalent `rem` values so the page gutter, sidebar, and grid gutter participate in the scale change.
- Preserve page structure, breakpoints, colors, interactions, and the relative responsive behavior; do not apply a transform or CSS `zoom`.

## Files likely to change

- `src/index.css`
- `tailwind.config.js`

## Implementation requirements

- Apply the scale globally so the header, navigation, product cards, typography, and other routes reduce consistently.
- Express the custom shared spacing values in `rem` using their current 16px-root equivalents before scaling.
- Do not make unrelated per-page design changes or change the device viewport.

## Security requirements

- Styling-only change; do not add scripts, dependencies, data collection, or expose or modify secrets.

## Acceptance criteria

- The overall storefront appears approximately 10% smaller at the same browser zoom and viewport.
- Existing relative sizing and mobile/desktop breakpoints remain intact.
- The layout does not gain horizontal overflow or break the header/product grid on desktop or mobile widths.
- The same shared scale applies on non-home routes.

## Checks to run

- `npm run typecheck`
- `npm run build`
- Inspect the home page and at least one non-home storefront route at mobile and desktop viewport widths.

## Exact manual test steps expected after implementation

1. Run `npm run dev` and open `http://localhost:5173/`.
2. At the browser's normal 100% zoom, compare the header, hero, section headings, product cards, and gutters; confirm the overall interface feels less enlarged.
3. Resize to a narrow mobile viewport and a desktop viewport; confirm the navigation behavior and product grid remain responsive and there is no horizontal page overflow.
4. Open `/shop` and `/product/<an-existing-product-id>` and confirm their controls, text, and layout use the same reduced scale.
