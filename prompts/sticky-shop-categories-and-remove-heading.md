# Sticky shop categories and remove heading block

## Goal

On the shop page, keep the desktop category sidebar visible while scrolling through products and reclaim the space used by the “All products” heading and its product-count subtitle.

## Skills read

- No applicable project skill is available for this React/Vite storefront task.
- No workspace `AGENTS.md` file was found.

## Existing code inspected

- `src/pages/Shop.jsx`: wraps the filters and results in `Page`, which currently displays a dynamic title (“All products”, a category/brand, or search results) and total-count intro above the grid; also has a separate toolbar count and sort control.
- `src/components/Page.jsx`: renders the optional page-heading block with a bottom margin.
- `src/index.css`: `.market-page` is a grid; `.market-filters` is a desktop-only sidebar at the 768px breakpoint; `.market-results` holds the product grid.
- `src/components/Header.jsx`: the site header is sticky at the top with a 66px minimum height; the announcement strip scrolls away.
- `src/pages/Home.jsx`: “Shop now” navigates to `/shop`.
- `package.json`: available checks are `npm run typecheck`, `npm test`, and `npm run build`; there is no lint script.

## Decisions or assumptions

- Remove the `Page` title and intro on `/shop`, including the “All products” heading and count directly beneath it, so the sidebar and product results move up into that space.
- Keep the count and sort controls in the existing results toolbar; this is separate from the heading-and-subtitle block.
- Make the category sidebar sticky only at desktop/tablet widths where the left sidebar is already displayed; keep the mobile category selector behavior unchanged.
- Set the sticky offset below the 66px sticky site header and constrain the sidebar height to the viewport, allowing its contents to scroll if needed.
- Preserve existing filters, product data, result handling, URLs, and search/category headings elsewhere in the app.

## Files likely to change

- `src/pages/Shop.jsx`
- `src/index.css`

## Implementation requirements

1. Render the shop page without the `Page` title/intro block and its reserved margin.
2. Ensure the category sidebar and product area begin in the space previously occupied by that block.
3. Make the desktop `.market-filters` sidebar sticky while scrolling vertically, with a top offset that prevents overlap with the sticky header.
4. Keep the sticky sidebar usable on short viewports and when category content exceeds the available viewport height.
5. Preserve the product count and sort toolbar, mobile category selector, category selection state, responsive layout, and accessibility labels.
6. Do not change other `Page` consumers, product listings, header behavior, or unrelated styles.

## Security requirements

- Do not inspect, display, change, or embed environment variables, secrets, or credentials.
- Do not add third-party scripts, services, network calls, or packages.

## Acceptance criteria

- Opening `/shop` from the homepage “Shop now” button shows categories and the product area without the “All products” title/count block above them.
- The category sidebar stays visible below the site header while scrolling through product cards on desktop widths.
- On short viewports or with a tall category list, the sidebar content remains accessible without covering the header.
- Mobile category selection, toolbar count/sort, category filtering, and product results continue to work.
- `npm run typecheck`, `npm test`, and `npm run build` pass.

## Checks to run

- `npm run typecheck`
- `npm test`
- `npm run build`

## Exact manual test steps expected after implementation

1. Run `npm run dev` and open `http://localhost:5173/`.
2. Click “Shop now”; verify the shop opens with no “All products” heading or product-count subtitle above the category/product layout.
3. Confirm the existing toolbar product count and sort selector remain visible.
4. At a desktop viewport, scroll down through the product grid and verify the category sidebar remains visible beneath the sticky header.
5. Resize to a shorter desktop viewport and verify the sidebar can scroll internally if needed and does not overlap the header.
6. At a mobile viewport, verify the category dropdown still filters products and there is no desktop sidebar.
7. Run the automated checks listed above.
