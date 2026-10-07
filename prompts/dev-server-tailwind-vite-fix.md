# Fix Tailwind CSS and Vite React integration

## Goal

Make `npm run dev` serve the storefront without the Tailwind PostCSS fatal error or Vite 8/React plugin compatibility warnings, while preserving the existing React application and Tailwind design tokens.

## Skills read

- No approved project skill applies to this Vite, React, and Tailwind configuration issue.

## Existing code inspected

- `package.json` and `package-lock.json`: Tailwind CSS 4.3 and Vite 8 are installed alongside `@vitejs/plugin-react` 4.7.
- `postcss.config.js`: configures the Tailwind package itself as a PostCSS plugin.
- `vite.config.js`: uses the legacy React Babel plugin.
- `src/index.css`: uses Tailwind 3 `@tailwind` directives and custom theme utilities through `@apply`.
- `tailwind.config.js`: defines the existing custom theme tokens and content paths.
- `prompts/windows-better-sqlite3-install.md`: existing prompt-file format.
- The parent `AGENTS.md` was read; this project is a Vite storefront, so its unrelated Next.js-specific checks do not apply.

## Decisions or assumptions

- Keep Tailwind CSS 4 and Vite 8 rather than downgrading the project's installed frameworks.
- Migrate the CSS/PostCSS integration to Tailwind 4 conventions, explicitly load the existing legacy Tailwind config so its custom tokens remain available, and retain existing stylesheet behavior.
- Upgrade `@vitejs/plugin-react` to its Vite 8-compatible v6 release. The separate `@vitejs/plugin-react-oxc` package currently declares peer support only through Vite 7, so it cannot be installed consistently with this project's Vite 8 dependency.
- Update `package.json` and `package-lock.json` only through npm dependency commands; do not hand-edit lockfile metadata.
- Do not redesign the storefront or change unrelated server behavior.

## Files likely to change

- `package.json`
- `package-lock.json`
- `postcss.config.js`
- `vite.config.js`
- `src/index.css`

## Implementation requirements

1. Configure the dedicated Tailwind 4 PostCSS plugin rather than `tailwindcss` directly.
2. Update the stylesheet to Tailwind 4's CSS entry syntax and load `tailwind.config.js` explicitly as needed for the existing custom colors, fonts, sizes, and spacing utilities.
3. Upgrade the React plugin to a release that supports Vite 8, preserving React JSX transformation and Fast Refresh behavior without the prior invalid `jsx` option warning.
4. Remove obsolete PostCSS integration only where required by the Tailwind 4 setup; avoid unrelated dependency changes.
5. Keep existing visual styles, custom utility classes, and `@apply` rules working.

## Security requirements

- Do not add or expose credentials, secrets, or environment-specific paths.
- Keep all changes limited to build and styling configuration.

## Acceptance criteria

- `npm run dev` starts both API and Vite processes without the Tailwind-as-PostCSS-plugin error.
- Vite no longer reports the legacy React plugin/JSX invalid-option warnings.
- Existing Tailwind classes and custom theme values compile and remain present in the generated CSS.
- The storefront loads and remains visually styled.
- The lockfile remains synchronized with `package.json`.
- Existing application typecheck, tests, and production build pass.

## Checks to run

- `npm run build`
- `npm run typecheck`
- `npm test`
- Start `npm run dev` and inspect startup and CSS compilation output.

## Exact manual test steps

1. From the project root in PowerShell, run `npm run dev`.
2. Confirm the API and Vite report ready and that the Tailwind PostCSS error and React plugin JSX warnings do not appear.
3. Open `http://localhost:5173/` and verify the storefront loads with its existing styling, including custom colors, typography, buttons, and cards.
4. Stop the dev server with Ctrl+C.
