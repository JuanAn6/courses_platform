# Course Platform

A learning platform for a single institution. Admins, secretaries, teachers, assistants, students and guardians use it to create, run and take courses.

- **Spec and roadmap:** [`docs/PLATFORM_SPEC.md`](docs/PLATFORM_SPEC.md)
- **Contributor and agent conventions:** [`CLAUDE.md`](CLAUDE.md)

## Getting started

Requirements: Node 20.9+ and MySQL 8 or MariaDB 10.4+.

```bash
cp .env.example .env          # set DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate            # create tables
npm run db:seed               # demo accounts
npm run dev                   # http://localhost:3000
```

Invites and password resets are emailed when `SMTP_URL` is set. Otherwise they are printed to the server console and shown as copyable links in the UI.

Every demo account uses the password `Password123!`:

| Role | Email |
|---|---|
| Admin | admin@school.test |
| Secretary | secretary@school.test |
| Teacher | teacher1@school.test, teacher2@school.test |
| Teaching assistant | assistant@school.test |
| Guardian | guardian@school.test (linked to student01 and student02) |
| Student | student01@school.test … student10@school.test |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | Route type generation + `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests on an isolated server (:3100) and database (`course_platform_e2e`, recreated each run) |
| `npm run script -- scripts/x.mts` | Run a maintenance/check script with app imports |
| `npm run db:migrate` / `db:seed` / `db:reset` / `db:studio` | Prisma |
