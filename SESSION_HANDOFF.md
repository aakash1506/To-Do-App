# Session Handoff — Todo App (Feature 01 Complete)

**Date:** 22 May 2026  
**GitHub repo:** https://github.com/aakash1506/To-Do-App  
**Branch:** `main`  
**Dev server:** `http://localhost:3000` (run command below to restart)

---

## What Was Accomplished This Session

### 1. PRP Created
`PRPs/01-todo-crud-operations.md` — full specification for Feature 01 covering user stories, DB schema, API contracts, validation rules, edge cases, and test requirements.

### 2. Project Scaffolded from Scratch
Next.js 15.3.2 app built manually (create-next-app couldn't handle the folder name). Stack:
- **Frontend:** Next.js 15 App Router, React 19, Tailwind CSS 3
- **Backend:** Next.js API routes
- **Database:** SQLite via `better-sqlite3` (file: `todos.db`)
- **Validation:** Zod
- **Testing:** Jest 29 + ts-jest (unit/integration), Playwright (E2E)
- **Node version:** v18.20.8

### 3. Feature 01 Implemented (TDD — tests written first)

#### Files Created
| File | Purpose |
|------|---------|
| `lib/timezone.ts` | Singapore TZ utilities: `getSingaporeNow`, `toSingaporeISO`, `isFutureDate`, `isPastDate`, `parseSingaporeDate` |
| `lib/db.ts` | SQLite schema + `todoDB` CRUD (synchronous). Exports: `Todo`, `CreateTodoDto`, `UpdateTodoDto`, `getDb`, `closeDb`, `todoDB` |
| `lib/validation.ts` | Zod schemas: `createTodoSchema`, `updateTodoSchema` |
| `app/api/todos/route.ts` | `GET /api/todos`, `POST /api/todos` |
| `app/api/todos/[id]/route.ts` | `GET/PUT/DELETE /api/todos/[id]` |
| `app/page.tsx` | Client UI — Add form, Overdue/Active/Completed sections, EditModal, optimistic updates |
| `app/layout.tsx` | Root layout |
| `app/globals.css` | Tailwind base styles |

#### Config Files
| File | Purpose |
|------|---------|
| `package.json` | All dependencies |
| `tsconfig.json` | TypeScript strict mode, `@/*` alias |
| `tailwind.config.js` | Tailwind config |
| `postcss.config.mjs` | PostCSS + autoprefixer |
| `jest.config.js` | Jest with ts-jest, CJS mode, 80% coverage threshold |
| `playwright.config.ts` | Playwright E2E, `Asia/Singapore` timezone |
| `railway.toml` | Railway deployment config |
| `.env.example` | Env var documentation |
| `.gitignore` | Excludes `.next`, `todos.db*`, `node_modules`, coverage |

### 4. Test Results (All Passing — 73/73)
```
__tests__/lib/timezone.test.ts     16 tests ✓
__tests__/lib/db.test.ts           25 tests ✓
__tests__/lib/validation.test.ts   16 tests ✓
__tests__/api/todos.test.ts        16 tests ✓
──────────────────────────────────────────
Total                              73 tests ✓
```
E2E tests in `tests/01-todo-crud.spec.ts` — written but not yet run against live server.

### 5. Production Build
`npm run build` — **passes** (Next.js 15.3.2).

### 6. Railway Deployment
- `railway.toml` committed and pushed
- Code pushed to `origin/main`
- **Pending:** User needs to connect the GitHub repo to Railway dashboard manually (see steps below)

---

## How to Resume

### Start Dev Server
```powershell
Push-Location "c:\Projects\Bitbucket\NUS AI Augmented SDLC course\To-Do App"
node node_modules\next\dist\bin\next dev
```
App runs at **http://localhost:3000**

### Run Tests
```powershell
Push-Location "c:\Projects\Bitbucket\NUS AI Augmented SDLC course\To-Do App"
& npx jest --forceExit
```

### Run Tests with Coverage
```powershell
& npx jest --coverage --forceExit
```

### Run E2E Tests (requires dev server running)
```powershell
& npx playwright test
```

### Production Build
```powershell
node node_modules\next\dist\bin\next build
```

---

## Railway Deployment (Pending)

The code is on GitHub. To finish deploying:

1. Go to https://railway.app/dashboard
2. **New Project → Deploy from GitHub repo**
3. Select repo: `aakash1506/To-Do-App`, branch: `main`
4. Railway auto-detects Next.js and uses `railway.toml`
5. Add env var: `NODE_ENV=production`
6. **Settings → Networking → Generate Domain** for public URL

Every `git push origin main` auto-deploys after setup.

> ⚠️ SQLite (`todos.db`) is ephemeral on Railway — data resets on each redeploy. Acceptable for demo; use PostgreSQL for production persistence.

---

## Next Features to Implement (from EVALUATION.md)

| # | Feature | Status |
|---|---------|--------|
| 01 | Todo CRUD Operations | ✅ Complete |
| 02 | Priority System | ⬜ Not Started |
| 03 | Recurring Todos | ⬜ Not Started |
| 04 | Reminders & Notifications | ⬜ Not Started |
| 05 | Subtasks & Progress Tracking | ⬜ Not Started |
| 06 | Tag System | ⬜ Not Started |
| 07 | Template System | ⬜ Not Started |
| 08 | Search & Filtering | ⬜ Not Started |
| 09 | Export & Import | ⬜ Not Started |
| 10 | Calendar View | ⬜ Not Started |
| 11 | Authentication (WebAuthn) | ⬜ Not Started |

### Recommended Next: Feature 02 — Priority System
- Add `priority TEXT NOT NULL DEFAULT 'medium'` to `todos` table in `lib/db.ts`
- Add `type Priority = 'high' | 'medium' | 'low'` to `lib/db.ts`
- Update `CreateTodoDto` and `UpdateTodoDto`
- Update Zod schemas in `lib/validation.ts`
- Add priority badge component and dropdown to `app/page.tsx`
- Auto-sort by priority (high → medium → low)
- Add priority filter dropdown
- Create PRP: `PRPs/02-priority-system.md`
- Write tests first (TDD)

---

## Key Architecture Decisions

- **No `src/` directory** — files live at root (`app/`, `lib/`, etc.)
- **`user_id` defaults to 1** — auth is not implemented yet (Feature 11)
- **`DB_PATH` read lazily** in `getDb()` — allows tests to set `process.env.DB_PATH` before first DB open
- **Test isolation** — each test suite uses a unique `mkdtempSync` directory for its SQLite DB, cleaned up in `afterAll`
- **`afterAll` at top level** of API test file (not inside a `describe`) to prevent premature DB/dir cleanup
- **`jest.config.js`** (CommonJS) used instead of `jest.config.ts` — avoids needing `ts-node` as a dependency
- **PowerShell quirk** — use `& npx ...` or `node node_modules\next\dist\bin\next ...` to run scripts (`.ps1` execution policy blocks `.bin\next.ps1`)

---

## Git History
```
14d2b94 chore: ignore SQLite WAL/SHM files
b88761a feat: add Railway deployment config
a273a36 Implemented 1st feature
c7b5fc2 Initial commit
b772c66 First commit
```
