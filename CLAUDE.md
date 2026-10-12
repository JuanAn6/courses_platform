@AGENTS.md

# Course Platform

Course platform for a single institution (LMS): courses, classes, units, entries, board, gradebook, attendance, messaging and payments.
**The full spec and build plan is in `docs/PLATFORM_SPEC.md`. Read it before starting any feature.** §6 lists the phases, and §9 lists the changes from the original plan.

## Stack
Next.js 16 (App Router, TS strict, `src/proxy.ts`) · Prisma 7 + `@prisma/adapter-mariadb` on MySQL/MariaDB · Better Auth · Tailwind v4 + shadcn/ui (Radix) · Zod 4 · Vitest + Playwright · npm.
The UI is English only. Cache Components is off, so pages render per request.

## Conventions
- Feature code lives in `src/features/<domain>/`, split into `actions.ts` ("use server"), `queries.ts` (server-only), `schemas.ts` (pure Zod) and `components/`.
- Form mutations use `action({ permission, schema }, handler)` from `src/lib/actions.ts`, which authorizes, validates FormData with Zod and returns an `ActionState`. Use `authorize()` for non-form actions. Throw `UserError` for expected failures.
- Pages and layouts guard themselves with `requireUser`, `requireArea` or `requirePermission` from `src/lib/auth/session.ts`. Area layouts guard too, but **every page also checks**, because layouts don't re-run on client navigation. `proxy.ts` is only an optimistic cookie check.
- Roles and permissions live in `src/lib/auth/permissions.ts`, a pure module that can be unit-tested. Add a permission key there rather than checking roles inline.
- Mutations on important data call `audit()` (`src/lib/audit.ts`), passing `tx` inside transactions. Updates record `diffObjects(before, after)`.
- Courses, classes, units, entries, users and posts are soft-deleted (`deletedAt`).
- Settings are typed groups in `src/features/settings/schemas.ts`. Read them with `getSettings(group)`.
- Times are stored in UTC and displayed with `formatDateTime(date, timezone)` using the institution's timezone setting.
- Pagination is cursor-based (see `admin/audit-log`).
- Modules marked `server-only` can't be imported by Vitest. Keep testable logic in pure modules.
- Never send quiz answers or sensitive student fields (medical notes, documents) to unauthorized users.

## Dev
- A local MySQL/MariaDB must be running (XAMPP MariaDB on :3306, user `root`, no password). Copy `.env.example` to `.env`.
- `npm run db:migrate` runs Prisma migrate dev. Run `npx prisma generate` after schema changes.
- `npm run db:seed` resets the demo accounts. Every account uses the password `Password123!`.
- `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test` (Vitest), `npm run test:e2e` (Playwright, needs the dev server and seeded data).

Demo logins: admin@, secretary@, teacher1@, teacher2@, assistant@, guardian@ and student01–10@school.test.

## Build order
Follow the phases in `docs/PLATFORM_SPEC.md` §6. Each phase must end runnable and tested: unit tests for logic, plus E2E tests for each role's flows. When a phase ships pages, add them to `src/lib/navigation.ts` and the `proxy.ts` matcher.
