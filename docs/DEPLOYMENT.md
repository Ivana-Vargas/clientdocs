# ClientDocs Deployment Guide

## Recommended stack

- App: Vercel (Next.js)
- Database: Neon/Supabase Postgres
- File storage (next phase): S3/R2 (replace local uploads)
- Rate limiting (next phase): Redis/Upstash (replace in-memory limiter)

## 1) Prepare environment variables

Copy `.env.example` and set secure values:

- `DATABASE_URL`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `MANAGER_EMAIL`, `MANAGER_PASSWORD`
- `JWT_SECRET` (minimum 32 chars in production)
- `JWT_ISSUER`, `JWT_AUDIENCE`

Never commit real secrets.

## 2) Database initialization (production)

Run in CI/CD or server startup job:

```bash
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

Notes:

- Keep migration files in git. They are required for reproducible production state.
- Do not use `db:push` in production.

## 3) Optional data cleanup before go-live

Default cleanup (sessions only):

```bash
npm run db:prepare:production
```

Full cleanup (clients/payments/documents/categories/sessions):

```bash
FULL_DB_CLEAN=true npm run db:prepare:production
```

Safety gate in production:

```bash
ALLOW_PRODUCTION_DB_CLEANUP=true FULL_DB_CLEAN=true npm run db:prepare:production
```

## 4) Build and run checks

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

## 5) Runtime security checklist

- Origin checks enabled for mutating endpoints (CSRF mitigation)
- Auth cookies use `httpOnly`, `sameSite=strict`, and `secure` in production
- Security headers + CSP enabled in `next.config.ts`
- File upload checks: MIME + PDF signature
- Local storage path traversal protection in place

## 6) Post-deploy operations

- Run auth session cleanup periodically:

```bash
npm run auth:sessions:cleanup
```

- Add monitoring/alerts for `401`, `403`, `429`, and `5xx` rates.
- Rotate `JWT_SECRET` and admin credentials periodically.

## 7) Final hardening tasks (recommended)

- Move rate limiting to Redis (shared across instances)
- Move document storage from local disk to S3/R2
- Add WAF rules in front of app
- Add CI SAST/DAST (CodeQL + OWASP ZAP baseline)
