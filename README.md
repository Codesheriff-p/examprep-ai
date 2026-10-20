# ExamPrep AI: AI-Powered Examination Preparation Assistant

ExamPrep AI turns a student's own course notes into a full revision workflow:

| Feature | What it does |
|---|---|
| **Notes & study guides** | Upload PDFs / `.txt` / `.md` files or paste text. One click turns a document into a study guide: summary, key points, key terms, and a plain-language version. All key terms are collected in a searchable course glossary. |
| **Practice quizzes** | Claude writes multiple-choice and written questions from the notes at a chosen difficulty and focus. Multiple choice is marked instantly; written answers are graded by Claude with feedback. |
| **Mock exams** | Timed papers (20/40/60 minutes) sampled across the whole syllabus. A countdown survives reloads, the paper is handed in automatically when time runs out, and answers appear only afterwards. |
| **AI tutor** | Streaming chat grounded in the notes, with five modes (Explain, Socratic, Quiz me, Simplify, Exam coach). Saved conversations, and one-click "Explain my mistake" / "Review with tutor" from quiz results. |
| **Flashcards** | AI-generated cards reviewed with SM-2 spaced repetition. Keyboard shortcuts: Space flips, 1–4 rates. |
| **Planner** | A day-by-day plan up to the exam date (max 4 weeks) that gives weak topics more time. List and month-calendar views, and export to Google/Apple/Outlook calendars (.ics). |
| **Focus timer & streaks** | Pomodoro/deep-work/sprint timer that logs study time. Quizzes, mock exams and flashcard reviews are logged too, building a daily study streak and weekly charts. |
| **Progress** | Per-topic mastery, score history, study time per day, and time by activity. |

The **adaptive loop** is the core idea: quiz results → per-topic mastery → weak topics → targeted quizzes, flashcards, and study plan.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions, Route Handlers) + **TypeScript**
- **Tailwind CSS 4**: every component is styled with Tailwind utilities. `globals.css` holds only the design tokens (colours, fonts, two keyframes) that utilities such as `bg-surface` and `text-muted` read. Reusable pieces live in `src/components/ui/`: Button, Card, Field/Input, Select (accessible custom dropdown), DatePicker (calendar with keyboard support), Badge, Progress, Segmented.
- **Lucide** icons, light and dark mode
- Type: Bricolage Grotesque (headings), Geist (body), Geist Mono (labels)
- **Prisma 7** ORM with **SQLite** (via the libSQL driver adapter)
- **Claude API** (`@anthropic-ai/sdk`) using `claude-opus-5-5`, with a built-in **offline mode** when no key is set
- **jose** (signed JWT session cookies) + **bcryptjs** (password hashing)
- **unpdf** for PDF text extraction, **react-markdown** for rendering tutor answers

## Getting started

Prerequisites: Node.js 20+. A Claude API key from <https://platform.claude.com> is optional (see *Offline mode*).

```bash
npm install                      # also generates the Prisma client
cp .env.example .env             # then fill in the values
npx prisma migrate dev           # creates dev.db
npm run db:seed                  # optional: demo account with a sample course
npm run dev                      # http://localhost:3000
```

### Demo account

`npm run db:seed` creates a demo student with a complete *Operating Systems* course:
two sets of notes, three quiz attempts, flashcards, a study plan and a tutor conversation.
Every screen therefore has content even before an API key is configured. The login page
shows the demo credentials (from `src/lib/demo-account.json`) under the login button, with a
one-click "Log in with the demo account" button. The box only appears once the demo
account exists, so a production database that was never seeded doesn't show it.
Re-running the seed resets the demo account.

`.env` values:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (optional: leave empty for offline mode) |
| `DATABASE_URL` | SQLite file, e.g. `file:./dev.db`, or a Turso URL `libsql://…` |
| `DATABASE_AUTH_TOKEN` | Turso auth token (hosted database only) |
| `SESSION_SECRET` | Random string for signing session cookies (`openssl rand -base64 32`) |

### Offline mode

Without `ANTHROPIC_API_KEY`, every AI feature still works using the offline engine in
`src/lib/offline-ai.ts`, which builds everything from the student's own notes with text analysis:

- **Topics** come from headings (ALL-CAPS lines, Markdown `#` lines, `Title:` lines).
- **Definitions** come from sentences like "A process is…", "Thrashing occurs when…" and `Term – description` lines.
- **Quizzes and mock exams**: term ↔ definition multiple choice, fill-in-the-blank, "which statement is correct?" and short-answer questions, spread across topics and weighted by difficulty and weak topics.
- **Short-answer grading**: marks by how many key words of the model answer the student covered, and names the missing ones.
- **Flashcards**, **study plans** (weak topics more often, mock exam two days before the exam, a light final day) and **study guides** (extractive summary, key points, glossary).
- **Tutor**: answers from the most relevant sentences in the notes in every mode, including a scored "Quiz me" and a hinting Socratic mode.

Add a key and restart the server to switch to Claude; nothing else changes.

### Deploying to Vercel

Vercel has no persistent disk, so a local SQLite file can't store accounts or data there. Use a
free hosted [Turso](https://turso.tech) database, which speaks the same libSQL protocol:

1. Create a Turso database, then copy its URL (`libsql://…`) and an auth token.
2. Create the tables in it from your machine:
   `DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" npm run db:deploy`
   (optional: run `npm run db:seed` the same way for the demo account).
3. In Vercel → Project → Settings → Environment Variables, add `DATABASE_URL`,
   `DATABASE_AUTH_TOKEN` and `SESSION_SECRET` (and `ANTHROPIC_API_KEY` if you have one), then redeploy.

`npm run db:deploy` applies `prisma/migrations` to any libSQL database and skips migrations
that were already applied, so re-run it after adding a migration.

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`.

If styles look out of date after editing `globals.css`, stop the dev server, delete `.next/dev`, and start it again (Turbopack can keep a stale Tailwind build in its cache).

## Project structure

```
prisma/schema.prisma          Data model: User, Course, Document (+ study guide), Quiz (practice | exam),
                              Question, QuizAttempt, AttemptAnswer, Conversation, ChatMessage,
                              Flashcard, StudyPlan, StudyTask, StudySession
prisma/seed.ts                Demo account with two sample courses
src/
  proxy.ts                    Redirects signed-out users away from app pages
  lib/
    ai.ts                     Every Claude call: quizzes, mock exams, grading, study guides,
                              flashcards, plans, tutor
    tutor-modes.ts            The five tutor modes (shared by client and server)
    study.ts                  Study sessions, streaks, daily totals
    progress.ts               Topic mastery, weak topics, course summary
    srs.ts                    SM-2 spaced repetition
    format.ts                 Date helpers ("in 3 days", local yyyy-mm-dd) and number formatting
    auth.ts, session.ts, db.ts, notes.ts, cn.ts
  components/ui/              Tailwind UI kit (see above)
  app/
    actions/                  Server Actions
    api/courses/[id]/chat/    Streaming tutor endpoint (creates conversations)
    api/courses/[id]/calendar/  .ics export of the exam date and study plan
    courses/[id]/             Overview, notes, quizzes (+ mock exams), tutor, flashcards,
                              plan (list + calendar), focus, progress
```

## How the AI is used

All model calls live in `src/lib/ai.ts`.

- **Grounding.** Every request sends the course's notes as the first system block, so answers come from the student's material rather than generic knowledge.
- **Prompt caching.** The notes block has `cache_control`, so later requests on the same course (another quiz, the next chat message) read it from cache. That cuts cost and latency.
- **Structured outputs.** Quizzes, grades, flashcards and plans are requested with a Zod schema (`messages.parse` + `output_config.format`), so the app always gets valid JSON. It never parses free text.
- **Streaming.** The tutor streams tokens to the browser as they are generated.
- **Effort levels.** Grading and flashcards use `low` effort (fast and cheap). Quiz writing, planning and tutoring use `medium`.
- **Refusal fallback.** Requests opt into the API's server-side fallback (`fallbacks: "default"`), so a request declined by a safety classifier is retried on a fallback model instead of failing.
- **Error handling.** API errors become messages the student can act on, such as a missing key, rate limiting, or notes that are too large.

## Security notes

- Passwords are hashed with bcrypt. Sessions are HTTP-only, SameSite=Lax, signed JWT cookies.
- Every page, action and API route loads data through `requireCourse()`, which checks that the course belongs to the signed-in user.
- Quiz answers and explanations are never sent to the browser until the attempt is submitted.

## Possible extensions

- OCR for scanned PDFs (currently only PDFs with a text layer work)
- Retrieval (embeddings and chunking) for very large note collections instead of sending all notes
- Past-paper import
- Deploying with Postgres (change the Prisma datasource and adapter)
