# Fix Windows installation failure for better-sqlite3

## Goal

Make `npm install` succeed on the project's stated Windows/Node 24 environment without depending on a broken Visual Studio/MSBuild installation, while keeping SQLite and the existing synchronous database API.

## Skills read

- No applicable project skill was available for this dependency-installation issue.
- The root `AGENTS.md` file was not present.

## Existing code inspected

- `package.json` and `package-lock.json`: the app currently installs `better-sqlite3` 11.10.0.
- `server/db.ts`: database setup imports `better-sqlite3` directly and uses its existing API.
- `README.md`: documented setup uses `npm install`.
- `Dockerfile`: production image uses Node 22.
- npm registry metadata: `better-sqlite3` 12.11.1 explicitly supports Node 20, 22, 23, 24, 25, and 26; its README documents prebuilt binaries for major platforms/architectures.

## Decisions and assumptions

- Upgrade only `better-sqlite3` to the latest compatible 12.x release, 12.11.1, rather than changing database libraries or requiring the user to repair Visual Studio.
- Preserve the current SQLite schema and database behavior; no database migration is expected from this dependency upgrade.
- Keep the existing `@types/better-sqlite3` dependency unless validation shows it needs a compatible update.
- Leave the general Node engine constraint and Docker Node version unchanged unless installation or checks demonstrate a compatibility issue.

## Files likely to change

- `package.json`
- `package-lock.json`
- `README.md` only if its install instructions need a small, relevant clarification.

## Implementation requirements

1. Update the runtime dependency to `better-sqlite3` `^12.11.1`.
2. Regenerate the lockfile using npm; do not hand-edit resolved versions or integrity hashes.
3. Keep `server/db.ts` and its current better-sqlite3 API unchanged unless a concrete incompatibility is found.
4. Do not change the Visual Studio configuration, add environment-specific paths, replace SQLite, or introduce unrelated dependency changes.

## Security requirements

- Do not add secrets or environment-specific user paths to tracked files.
- Preserve server-side-only database access and existing data handling.

## Acceptance criteria

- `npm install` completes successfully under the reported Windows Node 24 runtime without attempting to compile the native addon using the broken VS2026 MSBuild path.
- `better-sqlite3` resolves to 12.11.1 or a later compatible 12.x version in the lockfile.
- The server typechecks and the existing test suite passes.
- The production build completes.
- Existing DB initialization and seed/test behavior remain intact.

## Checks to run

- `npm install`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Exact manual test steps

1. From the project root in PowerShell, run `npm install`.
2. Confirm it exits successfully and does not report a `node-gyp`/MSBuild failure for `better-sqlite3`.
3. Run `npm run dev` and confirm the API and storefront start.
4. In a second terminal, run `npm run db:seed`, then reload the storefront and confirm the demo catalog still appears.
5. Stop the dev server with Ctrl+C.
