@AGENTS.md

# Course Platform

Course platform for a single institution (LMS): courses, classes, units, entries, board, gradebook, attendance, messaging and payments.
**The full spec and build plan is in `docs/PLATFORM_SPEC.md`. Read it before starting any feature.** §6 lists the phases, and §9 lists the changes from the original plan.

## Stack
Next.js 16 (App Router, TS strict, `src/proxy.ts`) · Prisma 7 + `@prisma/adapter-mariadb` on MySQL/MariaDB · Better Auth · Tailwind v4 + shadcn/ui (Radix) · Zod 4 · Vitest + Playwright · npm.
The UI is English only. Cache Components is off, so pages render per request.

## Conventions
- Feature code lives in `src/features/<domain>/`, split into `actions.ts` ("use server"), `queries.ts` (server-only), `schemas.ts` (pure Zod) and `components/`.
- Form mutations use `action({ permission, schema }, handler)` from `src/lib/actions.ts`, which authorizes, validates FormData with Zod and returns an `ActionState`.
  - Button and typed-argument calls use `command({ permission, schema }, handler)`.
  - Throw `UserError` for expected failures.
  - `"use server"` files may only export async functions. Put constants and schemas in `schemas.ts`.
- Client forms use `useActionForm(action, initial)` and render `<form action={formAction} onSubmit={onSubmit}>`, which keeps input after errors.
  - For destructive or one-off actions, use `<ConfirmButton run={() => cmd(args)} …/>`.
  - Form-field helpers (`optionalText`, `optionalDate`, `checkbox`, `formArray`) are in `src/lib/zod.ts`.
  - Use `useActionToast(state, onSuccess?)` for result toasts; it fires once per result.
- Pages and layouts guard themselves with `requireUser`, `requireArea` or `requirePermission` from `src/lib/auth/session.ts`. Area layouts guard too, but **every page also checks**, because layouts don't re-run on client navigation. `proxy.ts` is only an optimistic cookie check.
- Roles and permissions live in `src/lib/auth/permissions.ts`, a pure module that can be unit-tested. Add a permission key there rather than checking roles inline.
- Mutations on important data call `audit()` (`src/lib/audit.ts`), passing `tx` inside transactions. Updates record `diffObjects(before, after)`.
- Courses, classes, units, entries, users and posts are soft-deleted (`deletedAt`).
- Settings are typed groups in `src/features/settings/schemas.ts`. Read them with `getSettings(group)`.
- Times are stored in UTC and displayed with `formatDateTime(date, timezone)` using the institution's timezone setting.
- Pagination is cursor-based (see `admin/audit-log`).
- Modules marked `server-only` can't be imported by Vitest. Keep testable logic in pure modules.
- Never send quiz answers or sensitive student fields (medical notes, documents) to unauthorized users.
- Files are stored through `storage` (`src/lib/storage.ts`) and served only by `/api/files/[id]`. Add an access rule to `src/features/files/access.ts` for every new thing that references files.
- Account emails (invites, resets) go through `src/features/accounts/`. Never store raw tokens.
- Class pages guard with `requireClassStaff(classId)` or `requireClassViewer(classId)` (`src/features/academics/access.ts`). The pure rules are in `src/features/academics/rules.ts`.
- Enrollment writes go through `src/features/academics/enrollment-service.ts`, which locks the class row before checking capacity.
- Content: entry types are defined in `src/features/entries/registry.ts`, with editors in `components/editors.tsx` and viewers in `components/viewers.tsx`. A new type touches the Prisma enum, the registry and both maps.
- What a student can see or open is decided only by `buildOutline` (`src/features/entries/outline.ts`). File access goes through `canViewEntryContent`.
- Rich text is Tiptap JSON. Always save through `prepareContent` (whitelists it) and render with `RichTextView`, never as raw HTML.
- Uploads go through `POST /api/uploads?kind=` (streams to storage, limits in `UPLOAD_RULES`). Entries reference files via `EntryFile`.
- Dates typed by users are wall-clock times in the institution's time zone. Convert with `zonedInputToUtc` / `utcToZonedInput`.
- Assessment rules are pure: `assessment/questions.ts`, `quiz.ts` and `rubric.ts`. `QuizAttempt.snapshot` and question `data` contain answers. Never send them to a student; use `studentView` / `loadAttemptForStudent` and send only `view` and `response` to in-progress runners.
- Students acting on an entry go through `requireStudentEntry` (class membership, ACTIVE class, unlocked in the outline). Graders go through `requireClassGrader` / `canGradeClass`.
- A Server Action called inside a client transition that must navigate should return `{ url }` for `router.push`. Don't `redirect()` there.
- Before any transaction that may create a student, call `ensureStudentCodeSequence()`. Counters in `sequences` are incremented with raw SQL (see `service.ts`).

## Dev
- A local MySQL/MariaDB must be running (XAMPP MariaDB on :3306, user `root`, no password). Copy `.env.example` to `.env`.
- `npm run db:migrate` runs Prisma migrate dev. Run `npx prisma generate` after schema changes.
- `npm run db:seed` resets the demo accounts. Every account uses the password `Password123!`.
- `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test` (Vitest).
- `npm run test:e2e` runs Playwright on its own server (:3100) and database (`course_platform_e2e`, recreated each run), so it never touches dev data.
  - E2E tests must use unique emails (`uniqueId()`).
  - Tests run in parallel: don't reuse a seeded student whose state another test changes. student03's sessions are revoked by the password test.
  - Use `openConfirm()` for confirmation buttons right after a full page load (hydration).
- `npm run script -- scripts/<file>.mts` runs a TS script with app imports (`server-only` is stubbed).
- Without `SMTP_URL`, emails are printed to the dev server console. Invite and reset links are also shown in the UI.

Demo logins: admin@, secretary@, teacher1@, teacher2@, assistant@, guardian@ and student01–10@school.test.

## Build order
Follow the phases in `docs/PLATFORM_SPEC.md` §6. Each phase must end runnable and tested: unit tests for logic, plus E2E tests for each role's flows. When a phase ships pages, add them to `src/lib/navigation.ts` and the `proxy.ts` matcher.
