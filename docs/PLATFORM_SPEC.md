# Course Platform: Full Implementation Spec & Plan

## Context
`C:\projects\course_platform` is empty: this is a new project. The goal is one platform where a **single institution** can create, run and take courses of any kind. It covers:
- Roles: admin, secretary, teacher, assistant, student and guardian.
- A content hierarchy: **Course → Class → Unit (Theme) → Entry**.
- Many entry types: quizzes, video, text, slides, documents, documents with comments, and more.
- A shared **Board** with news and comments.
- Admin insights, secretary student management, a gradebook and certificates.
- Attendance and a calendar.
- Messaging and notifications.
- Payments.

This file holds all the context needed to build it. `CLAUDE.md` at the repo root summarizes the conventions.

**Status:** Phase 1 (Foundation) is done. See §6 for what it includes and §9 for changes from the original plan.

**Decisions made with the user:** Next.js full-stack, **MySQL**, single institution, **English-only UI** (strings kept in one place so i18n can be added later), and all four extras: gradebook and certificates, attendance and calendar, messaging and notifications, and payments.

---

## 1. Tech stack
| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components, Server Actions, `proxy.ts`), TypeScript strict. Cache Components is **off** (see §9) |
| DB | MySQL 8 or MariaDB 10.4+ (utf8mb4), **Prisma 7** (`provider = "mysql"`, `prisma.config.ts`, client generated to `src/generated/prisma`, `@prisma/adapter-mariadb` driver) |
| Auth | **Better Auth** (email and password now; magic link and Google OAuth later), database sessions, Prisma adapter |
| UI | Tailwind CSS + shadcn/ui, lucide icons, TanStack Table for data grids, Recharts for insights |
| Forms/validation | react-hook-form + Zod (one shared schema for client and server) |
| Rich text | Tiptap editor, content stored as JSON and sanitized HTML rendered on the server |
| File storage | S3-compatible storage (MinIO locally, S3/R2 in prod). Uploads go straight to storage through presigned URLs |
| Background jobs | BullMQ + Redis: emails, notifications, PPTX→PDF conversion, certificate PDFs, video transcode |
| Doc conversion | LibreOffice headless worker (PPTX/DOCX → PDF), react-pdf viewer |
| Video | Upload to S3 and play it with an HTML5/HLS player (hls.js). Also allow YouTube/Vimeo embeds |
| Email | Nodemailer (SMTP) with React Email templates |
| Realtime | Server-Sent Events endpoint for notifications and messages (no extra infra) |
| Payments | Stripe Checkout + webhooks |
| PDF generation | `@react-pdf/renderer` for certificates, receipts and report cards |
| Testing | Vitest (unit), Playwright (E2E), a seed script with demo data for each role |
| Dev infra | A local MySQL/MariaDB (currently XAMPP MariaDB 10.4, `root` with no password). Redis, MinIO and Mailpit get added when phases 4 and 10 need them. Package manager: **npm** |

**Conventions**
- Feature folders live under `src/features/<domain>`. Each one holds `actions.ts`, `queries.ts`, `schemas.ts` and `components/`.
- Every mutation is a Server Action wrapped by `authorize(permission, resourceCtx)`.
- Every mutation on important data writes an `AuditLog` row.
- Soft-delete with `deletedAt` is used for courses, classes, units, entries, users and posts.

---

## 2. Roles & permissions
Global roles live on `User.roles` (a user can have several). Class-scoped roles live on `ClassMember.role`.

| Role | Scope | Can do |
|---|---|---|
| **ADMIN** | Global | Everything: users and roles, settings, all courses and classes, insights, audit log, payments config, moderation of all boards, certificate templates |
| **SECRETARY** | Global (administrative) | Create, edit and import students and guardians, manage student records and documents, enroll and withdraw students in classes, manage payments, invoices and scholarships, print report cards and certificates, attendance reports. **No** content editing and no grading |
| **TEACHER** | Assigned classes (and courses where they are a course editor) | Edit content of their courses and classes, publish entries, grade, take attendance, post on class boards, message students, see class insights |
| **ASSISTANT** (teaching assistant) | Assigned classes | Grade and give feedback, take attendance, moderate the class board. Cannot delete content |
| **STUDENT** | Enrolled classes | Consume content, submit quizzes and assignments, comment, post on the board (if allowed), message teachers, see their grades and certificates, pay fees |
| **GUARDIAN** | Linked students | Read-only access to the linked student's grades, attendance, calendar and payments. Can message teachers |

Implementation:
- `src/lib/auth/permissions.ts` holds a static map of `Permission` → roles, plus resource checks such as `isClassStaff(userId, classId)` and `isEnrolled(...)`.
- Middleware protects route groups `/admin`, `/office` (secretary), `/teach` and `/learn`.
- Admins can **impersonate** ("view as") for support. Impersonation is audited.

---

## 3. Domain model (Prisma, MySQL)
How the content is organized:
- **Course**: the catalog item and syllabus template (e.g. "Algebra I").
- **Class**: one delivery of a course to a group, with its own dates, teachers, students and schedule (e.g. "Algebra I · 2026-Fall · Group A").
- **Unit/Theme**: an ordered section inside a course.
- **Entry**: one content item inside a unit.

Units and entries are authored on the **Course**, so every class inherits them. A class can **override** per entry: hide it, or change its release date and due date. A class can also add class-only units and entries (`classId` set).

Main models (fields abbreviated):

**Identity & people**
- `User`: id, email (unique), passwordHash?, name, avatarUrl, roles (JSON array of enum), status (ACTIVE / SUSPENDED / INVITED), lastLoginAt
- `StudentProfile`: userId, studentCode (unique), birthDate, documentId, phone, address, emergencyContact, medicalNotes (restricted), enrollmentDate, status (ACTIVE / GRADUATED / WITHDRAWN), customFields JSON
- `TeacherProfile`: userId, bio, specialties, hireDate
- `GuardianLink`: guardianUserId, studentUserId, relationship
- `StudentDocument`: studentId, type (ID / transcript / contract…), fileId, uploadedById. Secretary only
- `Account`, `Session`, `Verification` (Better Auth core tables; field names must match Better Auth). Global roles live in a `UserRole` join table (userId, role), not a JSON column

**Academic structure**
- `Category` (tree) → `Course`: id, code, title, slug, description (rich), coverFileId, categoryId, level, status (DRAFT / PUBLISHED / ARCHIVED), visibility (CATALOG / PRIVATE), price?, currency, selfEnroll bool, createdById
- `CourseEditor`: courseId, userId (the teachers who can edit the course content)
- `AcademicTerm`: name, startDate, endDate
- `Class`: id, courseId, termId?, name, code, startDate, endDate, capacity, status, boardPolicy (STUDENTS_CAN_POST / COMMENT_ONLY / READ_ONLY), enrollmentPrice override?
- `ClassMember`: classId, userId, role (TEACHER / ASSISTANT / STUDENT), status (ACTIVE / WITHDRAWN / COMPLETED), enrolledAt, finalGrade?
- `ClassSchedule`: classId, weekday, startTime, endTime, room/meetingUrl. Used to generate `ClassSession` rows
- `Unit`: courseId, classId?, title, description, position, releaseAt?, prerequisitesUnitId?
- `Entry`: unitId, classId?, type (enum below), title, description, position, status (DRAFT / PUBLISHED), releaseAt?, dueAt?, points?, gradeCategoryId?, required bool, settings JSON, content JSON
- `EntryClassOverride`: entryId, classId, hidden, releaseAt, dueAt
- `File`: id, storageKey, mime, size, originalName, ownerId, status, derived JSON (pdfKey, hlsKey, thumbnails, pageCount)

**Entry types** (`EntryType` enum; `content` and `settings` are JSON shapes validated by a Zod schema for each type):
| Type | Content | Student interaction |
|---|---|---|
| `TEXT` | Tiptap JSON (headings, images, code, math via KaTeX, embeds) | Mark complete, comments |
| `VIDEO` | fileId (HLS) **or** an external URL (YouTube/Vimeo), chapters, captions file | Progress tracked by % watched; completion threshold |
| `PRESENTATION` | Uploaded PPTX/PDF → converted PDF shown as slides; or a Google Slides embed | Slide-by-slide view, completion when the last slide is reached |
| `DOCUMENT` | One or more files (PDF / DOCX / XLSX / images), inline viewer + download | Mark complete |
| `ANNOTATED_DOCUMENT` | A PDF with **anchored comments** (page + rect/highlight) | Students and teachers add threaded comments on regions; teacher can mark them resolved; private or shared mode |
| `QUIZ` | Questions (see quiz engine) | Attempts, auto-grading, feedback |
| `ASSIGNMENT` | Instructions + rubric | File and/or text submission, teacher grades with rubric + feedback, resubmission |
| `LINK` / `EMBED` | URL or iframe (H5P, Genially, Figma…) | Mark complete |
| `AUDIO` | Audio file / podcast | Progress |
| `LIVE_SESSION` | Meeting URL + datetime (links to calendar and attendance) | Join, attendance |
| `FORUM` | A discussion topic scoped to the entry | Threaded replies, can be graded |

Adding a type later = add an enum value, a Zod schema, an editor component and a viewer component, registered in `src/features/entries/registry.ts`.

**Progress & engagement**
- `EntryProgress`: userId, entryId, classId, status (NOT_STARTED / IN_PROGRESS / COMPLETED), percent, lastPosition (video seconds or slide number), timeSpentSec, completedAt
- `EntryComment`: entryId, classId, authorId, parentId, body, anchor JSON? (page, rects for annotated docs), visibility (CLASS / PRIVATE_TO_STAFF), resolved

**Quiz engine**
- `QuestionBank` (per course) → `Question`: type, prompt (rich), options JSON, answer JSON, explanation, points, tags, difficulty
  - Question types: SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER (accepted answers / regex), NUMERIC (tolerance), MATCHING, ORDERING, FILL_BLANKS, ESSAY (manual grading), FILE_UPLOAD (manual)
- `QuizQuestion`: entryId, questionId or a random-pick rule (bank tag + count), position
- Quiz settings (Entry.settings): timeLimit, maxAttempts, scoring policy (highest / last / average), shuffle questions/options, show results/answers (never / after submit / after due date), open/close window, passing score, question-per-page
- `QuizAttempt`: entryId, classId, userId, startedAt, submittedAt, score, status (IN_PROGRESS / SUBMITTED / NEEDS_GRADING / GRADED), questionSnapshot JSON
- `QuizAnswer`: attemptId, questionId, response JSON, autoScore, manualScore, feedback
- Grading on the server only. The timer is enforced on the server (startedAt + limit), and autosave runs every 15 s.

**Assignments & grading**
- `Submission`: entryId, classId, userId, text, fileIds, submittedAt, late bool, attemptNo, status
- `Rubric` / `RubricCriterion` / `RubricLevel`; `Grade`: classId, userId, entryId, score, maxScore, feedback, gradedById, gradedAt, released bool
- `GradeCategory`: classId (or courseId default), name, weight %. Gradebook = weighted average. Manual items (oral exam, etc.) are possible through `GradeItem` without an entry
- `Certificate`: userId, classId, code (unique, verifiable at `/verify/[code]`), issuedAt, fileId. `CertificateTemplate` (admin-designed, with placeholders)
- Course completion rule (per class): all required entries completed and/or final grade ≥ passing → auto-issue the certificate (job)

**Attendance & calendar**
- `ClassSession`: classId, startsAt, endsAt, topic, location/meetingUrl, entryId? (LIVE_SESSION)
- `AttendanceRecord`: sessionId, userId, status (PRESENT / ABSENT / LATE / EXCUSED), note, recordedById
- `CalendarEvent`: scope (GLOBAL / CLASS / USER), classId?, title, startsAt, endsAt, type (holiday / exam / event). The calendar view merges events, sessions and entry due dates. Users get an iCal feed URL

**Board (news & discussion)**
- `BoardPost`: scope (INSTITUTION / COURSE / CLASS), courseId?, classId?, authorId, type (NEWS / ANNOUNCEMENT / DISCUSSION / QUESTION), title, body (rich), attachments, pinned, allowComments, publishedAt (schedulable), status
- `BoardComment`: postId, parentId (threaded, 2 levels), authorId, body
- `Reaction`: polymorphic (postId / commentId), userId, emoji
- Feed = institution posts + posts from every course/class the user belongs to, plus **auto-generated activity items**: new entry published, grades released, upcoming due dates, new class session. These come from a `ActivityEvent` table so the "news of everything" feed has everything.
- Moderation: `Report` model; staff can hide posts and lock comments. Announcements also send a notification.

**Messaging & notifications**
- `Conversation` (DIRECT / GROUP / CLASS_BROADCAST), `ConversationParticipant` (lastReadAt), `Message` (body, attachments)
- Rules: students can message staff of their classes. Students can message each other only if the admin setting allows it. Guardians can message teachers.
- `Notification`: userId, type, title, body, link, readAt. `NotificationPreference`: per type × channel (in-app / email / digest)
- Delivery: in-app through SSE, and email through a BullMQ job, with a daily digest option.

**Payments**
- `PriceItem`: course/class/fee name, amount, currency
- `Invoice`: studentId, items, total, status (DRAFT / OPEN / PAID / VOID / OVERDUE), dueDate. `Payment`: invoiceId, method (STRIPE / CASH / TRANSFER), amount, stripeSessionId, recordedById
- `Discount`/`Scholarship`: percent or fixed, per student or code
- Flow: self-enroll on a paid course → Stripe Checkout → webhook marks it paid → enrollment created. The secretary can create manual invoices, record cash or transfer payments, and issue PDF receipts. An optional setting blocks content access when an invoice is overdue.

**Platform**
- `Setting` (key/value JSON): institution name, logo, colors, grading scale, passing score, messaging rules, payment config
- `AuditLog`: actorId, action, entityType, entityId, diff JSON, ip, createdAt
- `ActivityEvent`: for the feed and insights (entry viewed / completed, login, submission…)

Indexes: FKs, `(classId, userId)` on progress/grades, `(userId, readAt)` on notifications, FULLTEXT on Course(title, description) and BoardPost(title, body) for search.

---

## 4. Application areas (routes)
```
src/app/
  (public)/            /, /catalog, /catalog/[slug], /verify/[code], /login, /register, /invite/[token]
  (app)/
    dashboard/         role-aware home: upcoming deadlines, continue learning, news feed
    board/             global feed + /board/[postId]
    calendar/
    messages/ [conversationId]
    notifications/
    profile/ settings/
  learn/               STUDENT
    classes/[classId]/              class home: units outline, progress, class board
    classes/[classId]/entries/[entryId]  entry player (type-specific viewer)
    grades/  certificates/  payments/
  teach/               TEACHER / ASSISTANT
    classes/[classId]/  overview | content | students | gradebook | attendance | board | insights
    courses/[courseId]/edit   course builder: units & entries drag-drop, question bank
    grading/            queue of submissions/attempts needing grading
  office/              SECRETARY
    students/ [id]      list/search/filter, profile, documents, guardians, enrollments, payments, attendance
    students/import     CSV import with preview + validation
    enrollments/        bulk enroll/withdraw/move between classes
    invoices/ payments/ reports/ (report cards, attendance, payment reports - PDF/CSV)
  admin/               ADMIN
    insights/           dashboards
    users/ roles/ courses/ classes/ categories/ terms/
    board-moderation/ certificates/templates/ settings/ audit-log/
  guardian/            linked students' overview
  api/
    auth/[...nextauth]  uploads/presign  uploads/complete  files/[id] (signed download)
    stripe/webhook  sse/  calendar/[token].ics  cron/ (jobs triggers)
```

## 5. Key features per role (acceptance checklist)
**Admin**
- CRUD for users (invite by email, assign roles, suspend, reset password, impersonate).
- CRUD for categories, courses, terms and classes. Clone a course or class. Assign teachers and course editors.
- Edit any content. Archive and restore.
- **Insights dashboard**:
  - Active users (DAU/WAU).
  - Enrollments over time, revenue, completion rate per course/class.
  - Average grades, quiz item analysis (difficulty and discrimination per question).
  - Hardest entries (lowest completion, most time).
  - At-risk students (low progress, absences, overdue items).
  - Teacher activity (grading turnaround).
  - Filters: term / course / class. CSV export.
- Board moderation, certificate templates, global settings, audit log viewer.

**Secretary**
- Student directory with filters and search.
- Full student record: personal data, documents, guardians, enrollments history, grades (read-only), attendance, payments.
- CSV bulk import/export. Enroll, withdraw or transfer students. Generate invoices and record payments.
- Print report cards and certificates. Attendance and payment reports.

**Teacher**
- My classes. Course builder with drag-and-drop units/entries and an editor for each entry type. Question bank. Schedule releases.
- Class roster with progress per student. Gradebook (weighted, editable, release grades, CSV export). Grading queue with rubric.
- Annotated-document comments. Attendance taking for each session.
- Class board posts and announcements. Message students. Class insights (progress heatmap students × entries).

**Student**
- Dashboard ("continue where you left off", deadlines, feed).
- Class outline with locks and progress. Entry players. Quizzes with timer and autosave. Assignment submission.
- Comments and board posts. Grades and feedback. Certificates. Calendar. Messages. Pay invoices. Browse the catalog and self-enroll.

**Guardian**
- Read-only overview of linked students. Can message teachers. Can pay invoices.

---

## 6. Implementation phases (build in order; each one ends runnable and tested)
1. **Foundation** ✅ *done*
   - Scaffold Next.js + TS, Tailwind/shadcn, Prisma (MySQL), env validation (`src/env.ts` with Zod).
   - Better Auth, User/roles, permissions helper, layouts per role, audit log, settings.
   - Seed script with an admin, a secretary, 2 teachers, 10 students and a guardian.
2. **People management**
   - Admin user CRUD and invites.
   - Secretary student records, documents, guardians, CSV import.
3. **Academic structure**
   - Categories, courses, terms, classes, class members, enrollments, catalog.
4. **Content engine**
   - File uploads (presigned S3) and conversion worker.
   - Unit/Entry builder, entry registry with TEXT, VIDEO, DOCUMENT, PRESENTATION, LINK/EMBED, AUDIO.
   - Players, progress tracking, release/override logic.
5. **Assessment**
   - Question bank, QUIZ (all question types, attempts, timer, auto + manual grading).
   - ASSIGNMENT with rubrics. Grading queue.
6. **Annotated documents & entry comments** (PDF anchored threads), FORUM entry.
7. **Board**: posts, comments, reactions, scopes, scheduling, moderation, activity-feed generation.
8. **Gradebook & certificates**: categories/weights, manual items, release, report-card PDF, completion rules, certificate templates, verification page.
9. **Attendance & calendar**: schedules → sessions, attendance taking, LIVE_SESSION entries, merged calendar, iCal feed.
10. **Messaging & notifications**: conversations, SSE, notification types and preferences, email and digest jobs.
11. **Payments**: price items, Stripe Checkout + webhook, invoices, manual payments, receipts, scholarships, overdue access rule.
12. **Insights**: admin and teacher dashboards, at-risk detection, quiz item analysis, CSV exports.
13. **Hardening**:
    - Rate limiting and security headers.
    - File virus scan hook. Access checks on every file download (signed URLs, short TTL).
    - Accessibility pass (WCAG AA), performance (pagination, caching), Playwright E2E for each role, production Dockerfile.

## 7. Non-functional requirements
- Authorization is checked on the server for every query and action, never only in the UI. Student data (medical notes, documents) is visible only to secretary and admin.
- Students never receive quiz answers before the policy allows it (questions are served from the snapshot without the `answer` field).
- Pagination is cursor-based on feeds and lists. Large uploads use multipart presigned uploads, up to a 2 GB video limit (configurable).
- Times are stored in UTC and shown in the institution's timezone setting.
- GDPR-like basics: export and delete a user's data (admin), consent field.

## 8. Verification
- Start MySQL/MariaDB, then run `npm install`, `npm run db:migrate`, `npm run db:seed` and `npm run dev`. Log in as each seeded role (password `Password123!`).
- Vitest unit tests for:
  - permissions map
  - quiz grading for every question type
  - gradebook weighted math
  - release/override visibility
  - completion → certificate rule
- Playwright E2E flows:
  1. Admin creates a course and a class and assigns a teacher.
  2. Secretary imports students via CSV and enrolls them.
  3. Teacher builds a unit with text, video, PDF-with-comments, a quiz and an assignment, then publishes it.
  4. Student completes the entries, takes the quiz and submits the assignment. Teacher grades it and the student sees the grade and a notification.
  5. Board post with comments from a teacher and a student.
  6. Attendance taken. The calendar shows the session and the deadline.
  7. Stripe test-mode checkout enrolls a student (webhook through `stripe listen`).
  8. Certificate issued and verifiable at `/verify/[code]`.
  9. Admin insights show the resulting data.

## 9. Changes from the original plan (decided during implementation)
- **Better Auth instead of Auth.js.** Auth.js v5 never left beta and is in maintenance mode, while Better Auth is stable and actively maintained.
  - Suspended or deleted users are blocked by a `databaseHooks.session.create.before` hook.
  - `getCurrentUser()` also re-checks status on every request, so a suspension takes effect immediately.
- **Next.js 16 and Prisma 7** were the current versions at build time.
  - Prisma 7 needs a driver adapter (`@prisma/adapter-mariadb`, which works with both MySQL and MariaDB) and a `prisma.config.ts`.
- **MariaDB 10.4 (XAMPP)** is the dev database. Prisma's MySQL connector supports it, and `Json` columns work.
- **Cache Components disabled.** Almost every page reads the session and per-user data, so pages render at request time. Re-enabling it for public pages (catalog, certificate verification) is a later option.
- **Built-in password-change behavior.** Better Auth's `revokeOtherSessions` rotates the current cookie mid–Server Action, which breaks the re-render. We delete other sessions ourselves and keep the current one.
- **Docker deferred.** It isn't installed on the dev machine, so `docker-compose.yml` comes when Redis and MinIO are needed.

### Phase 1 deliverables (for reference)
- **Auth:** `src/lib/auth/`
  - `auth.ts`: Better Auth config.
  - `session.ts`: `getCurrentUser`, `requireUser`, `requireArea`, `requirePermission`.
  - `permissions.ts`: roles, permission map, areas.
- **Actions:** `src/lib/actions.ts`, with the `action()` wrapper (authorize, then Zod validation, then `ActionState`) and `authorize()`.
- **Audit:** `src/lib/audit.ts` and `src/lib/diff.ts`.
- **Settings:** `src/features/settings/`, holding the typed groups `general`, `academic` and `messaging`, each with defaults.
- **Areas:** `/admin` (overview, settings, audit log), `/office`, `/teach`, `/learn`, `/guardian`, `/dashboard` and `/profile` (change password).
- **Access control:** the optimistic `src/proxy.ts` cookie check, plus a server-side check in every area layout and page.
- **Seed:** `prisma/seed.ts` (idempotent) creates:
  - `admin@`, `secretary@`, `teacher1@`, `teacher2@`, `assistant@` and `guardian@school.test`.
  - `student01…10@school.test`.
  - The guardian is linked to student01 and student02.
- **Tests:**
  - Vitest (`src/**/*.test.ts`): permissions, navigation, settings parsing, redirect safety, DB URL parsing, diff.
  - Playwright (`e2e/`): login and redirect-back, bad password, sign-out, password change revoking other sessions, the access matrix for each role, and admin settings with an audit trail.
