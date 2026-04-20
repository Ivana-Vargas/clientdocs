# ClientDocs | Secure Client Document Manager

## Project status (handoff)

This section is the source of truth to continue work in another chat without losing context.

### What is already implemented

- Full-stack Next.js app with strict module separation:
  - `src/app` -> frontend pages, UI, API routes.
  - `src/server` -> backend domain/application/infrastructure logic.
  - `src/database` -> Prisma schema, migrations, DB client, seed.
  - `src/shared` -> localization and shared types.
- Authentication flow completed and working:
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
- Secure cookie-based session handling:
  - access token + refresh token cookies.
  - refresh token rotation backed by PostgreSQL.
  - hashed refresh tokens stored in `auth_sessions`.
- Route protection enabled for private pages via access token validation.
- Localized UI and labels in Spanish/English with language switcher.
- Standard API response shape and centralized HTTP/app error handling.
- UX feedback system implemented:
  - toast notifications,
  - alert modal fallback for service failures,
  - input error highlighting,
  - password visibility toggle.
- Logging and diagnostics:
  - app logger (`pino`),
  - optional HTTP color logs (`ENABLE_HTTP_COLOR_LOGS=true`).
- Session maintenance command implemented:
  - `npm run auth:sessions:cleanup`
  - retention controlled by `AUTH_SESSION_RETENTION_DAYS`.

### Database state

- Prisma schema: `src/database/schema/prisma.schema`
- Initial migration includes:
  - `users`
  - `auth_sessions`
  - `clients`
  - enums `UserRole` and `ClientStatus`
- Seed script (`src/database/seeds/seed-users.ts`) creates/updates:
  - admin user (required),
  - manager user (optional if env vars are set).

### Infrastructure context used so far

- Local PostgreSQL stack is running with Docker.
- Known local setup path (outside repo):
  - `C:/Users/santi/.infra-db/projects/clientdocs`
- Current local DB URL used by app:
  - `postgresql://dev:devpass@localhost:5432/clientdocs`

### Testing status

- Existing integration tests for auth and locale routes are passing in current flow.
- Test config uses `fileParallelism: false` to avoid DB race conditions.

### Current work in progress

- `clients` feature started but not finished.
- Created so far:
  - `src/server/features/clients/domain/client-status.ts`
- `src/app/(private)/clients/page.tsx` is still a placeholder screen.
- `src/app/api/clients/` is still pending implementation.

### Next implementation steps

1. Implement backend `clients` module (domain, validation, services, repository).
2. Add API routes for clients:
   - list clients,
   - create client,
   - get client by id,
   - update client.
3. Protect clients API routes with existing auth guard.
4. Build `/clients` UI with list + create/edit form fields:
   - full name,
   - phone,
   - national id,
   - email,
   - address,
   - notes,
   - status.
5. Add i18n strings for all client UX and API error messages.
6. Add integration tests for `/api/clients` routes.

## Stack

- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma
- JWT auth
- Zod
- Vitest

## Structure

```txt
clientdocs/
  .env
  README.md
  src/
    app/
    server/
    database/
    shared/
```

## Commands

- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Tests: `npm run test`
- DB generate client: `npm run db:generate`
- DB migrate: `npm run db:migrate`
- DB push (non-migration sync): `npm run db:push`
- DB seed users: `npm run db:seed`
- DB studio: `npm run db:studio`
- Cleanup auth sessions: `npm run auth:sessions:cleanup`

## Required environment variables

Use `.env` with at least these keys:

- `NODE_ENV`
- `APP_URL`
- `DATABASE_URL`
- `JWT_ACCESS_TOKEN_TTL`
- `JWT_REFRESH_TOKEN_TTL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `MANAGER_EMAIL`
- `MANAGER_PASSWORD`
- `AUTH_SESSION_RETENTION_DAYS`

## Notes for future chat handoff

- Continue from clients module implementation.
- Keep commit messages in lowercase conventional format (`feat:`, `fix:`, etc.).
- Preserve architecture boundaries (`app`, `server`, `database`, `shared`).
- Keep i18n parity for ES/EN on every new user-facing text.
