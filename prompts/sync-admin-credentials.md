# Sync administrator credentials from environment

## Goal

Create or update the PostgreSQL administrator account from the server-only `ADMIN_EMAIL` and `ADMIN_PASSWORD` values in the project-root `.env`, without resetting or altering other store data.

## Skills read

- No applicable project skill was available for this Express/tRPC PostgreSQL task.
- No project `AGENTS.md` was found.

## Existing code inspected

- `server/config.ts`: loads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATABASE_URL` from dotenv.
- `server/seed.ts`: current admin upsert hashes the configured password for inserts but does not update the password hash for an existing email; the general seed/reset path is not safe for this operation.
- `server/auth.ts`: existing password hashing and verification helpers.
- `server/db.ts`: PostgreSQL transaction and connection lifecycle.
- `server/tests/api.test.ts`: PostgreSQL-compatible test pool and auth test patterns.
- `server/tests/sqlite-importer.test.ts`: database transaction testing pattern.
- `package.json`: database command scripts.

## Decisions or assumptions

- `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` are the requested source of truth.
- Sync only the account whose email matches `ADMIN_EMAIL`; leave other users and admin accounts unchanged.
- If the matching email already exists, set its role to `admin` and replace its password hash using the repository's password-hashing helper.
- If it does not exist, insert an administrator account using the configured email, a store-admin display name, and the hashed configured password.
- Do not run `db:seed`, reset the database, or print the configured email/password/hash.
- The credential write should be an explicit, narrowly scoped command rather than an automatic password reset on every server startup.

## Files likely to change

- `server/seed.ts` or a small admin-account service under `server/`
- A dedicated command entry point such as `server/sync-admin.ts`
- `package.json`
- `server/tests/api.test.ts` or a focused admin-sync test file
- `README.md` for the command and safe usage

## Implementation requirements

1. Require non-empty `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATABASE_URL`; fail clearly without displaying their values.
2. Reuse the established password hash helper; never store the raw password.
3. Upsert only the configured email, grant the `admin` role, and update the password hash.
4. Make the account write transactional and do not touch other users, orders, catalog, or imported data.
5. Add an explicit command such as `npm run db:sync-admin`; ensure it closes the PostgreSQL pool on success or failure.
6. Provide tests for inserting a missing admin, updating an existing account/password and role, preserving unrelated rows, and rejecting missing credentials.
7. Document the command without including secret values.

## Security requirements

- Never print, expose, or commit values from `.env`, the raw password, or its hash.
- Keep all credential reads and database writes server-side.
- Parameterize SQL values.
- Do not reset or overwrite the whole database.

## Acceptance criteria

- Running the dedicated command creates or updates exactly the configured admin account in PostgreSQL.
- The configured raw password authenticates through the existing login flow, while the database stores only its password hash.
- All unrelated accounts, orders, and catalog data remain unchanged.
- Missing configuration fails explicitly without logging secret values.

## Checks to run

- `npm run typecheck`
- `npm test`

## Exact manual test steps

1. Confirm the project-root `.env` has non-empty `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; do not paste or display them.
2. Run `npm run db:sync-admin`.
3. Sign in through the existing admin login using the email and password already configured in `.env`.
4. Confirm the admin area opens and existing catalog/orders remain present.
