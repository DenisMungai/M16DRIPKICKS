# Reduce homepage product card sizes

## Goal

Make product cards in the homepage's New arrivals, Best sellers, and Deals rows smaller and less visually dominant without changing product cards on other pages.

## Skills read

- No listed project skill applies to this styling/layout-only change.
- No `AGENTS.md` file was found in the workspace.

## Existing code inspected

- `src/pages/Home.jsx`: homepage `Row` component renders the three product sections, currently limiting each section to three products and using two columns from the `sm` breakpoint and three from `xl`.
- `src/components/ProductGrid.jsx`: grid accepts responsive column classes via `cols`.
- `src/components/ProductCard.jsx` and `src/index.css`: shared card/image styling; keep shared styles unchanged to avoid altering cards on other pages.
- `tailwind.config.js`: page and breakpoint-related design tokens.
- `package.json`: available `typecheck` and `build` scripts.

## Decisions or assumptions

- Interpret “product cards in the home page are too big” as reducing the width of each card within the homepage's product rows, not scaling or redesigning every card globally.
- Display four products in each homepage product row so the wide-screen four-column grid is balanced rather than leaving an empty grid cell.
- Keep two columns at small/tablet widths and three at intermediate desktop widths, increasing to four only at wide desktop widths.
- Preserve the shared `ProductCard` appearance and all non-home grids.

## Files likely to change

- `src/pages/Home.jsx`

## Implementation requirements

- Update the homepage `Row` grid column classes to use two columns at `sm`, three columns at `lg`, and four at `2xl`.
- Update each homepage section to provide up to four products, keeping the displayed total consistent with the number of provided items.
- Do not modify shared card CSS, the ProductCard component, product behavior, or non-home page grids.

## Security requirements

- UI-only change; do not modify environment files, credentials, API behavior, or data access.

## Acceptance criteria

- On wide desktop screens, each homepage product row can show four evenly sized cards.
- At small/tablet and intermediate desktop widths, the rows remain responsive and avoid cramped cards.
- New arrivals, Best sellers, and Deals remain populated with up to four products each.
- Product cards on Shop and other non-home pages remain unchanged.

## Checks to run

- `npm run typecheck`
- `npm run build`

## Exact manual test steps expected after implementation

1. Run `npm run dev` and open the homepage.
2. At a wide desktop viewport, confirm all three product rows display up to four compact cards across.
3. Resize through tablet and mobile widths; confirm the grids reflow to three and two columns respectively, with no horizontal overflow.
4. Open `/shop` and confirm its existing product-card sizing and grid are unchanged.
