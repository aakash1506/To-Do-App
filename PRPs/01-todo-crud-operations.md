# PRP 01 — Todo CRUD Operations

## Feature Overview

Implement the foundational CRUD operations for todos. This is Feature 01 and the base upon which all subsequent features build. Todos are stored in SQLite via `better-sqlite3` and served via Next.js 16 App Router API routes. All date/time values use Singapore timezone (`Asia/Singapore`).

---

## User Stories

| ID | As a… | I want to… | So that… |
|----|-------|-----------|----------|
| US-01 | user | create a todo with just a title | I can quickly capture tasks |
| US-02 | user | create a todo with a due date | I can track deadlines |
| US-03 | user | view all my todos | I can see what needs to be done |
| US-04 | user | mark a todo as complete | I can track progress |
| US-05 | user | edit a todo's title or due date | I can correct mistakes |
| US-06 | user | delete a todo | I can remove tasks I no longer need |
| US-07 | user | see todos grouped by Overdue/Active/Completed | I can focus on what matters |

---

## User Flow

```
1. Page loads → fetch todos from GET /api/todos
2. User types title in input → clicks Add
3. POST /api/todos → new todo appears in Active section
4. User clicks checkbox → PUT /api/todos/[id] { completed: true }
5. Todo moves to Completed section
6. User clicks Edit → modal opens pre-filled
7. User edits → PUT /api/todos/[id] → updates in-place
8. User clicks Delete → confirmation dialog
9. User confirms → DELETE /api/todos/[id] → removed from list
```

---

## Technical Requirements

### Database Schema (`lib/db.ts`)

```sql
CREATE TABLE IF NOT EXISTS todos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL DEFAULT 1,  -- placeholder until auth added
  title        TEXT NOT NULL,
  completed    INTEGER NOT NULL DEFAULT 0,
  due_date     TEXT,                          -- ISO8601, Singapore timezone
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
```

### TypeScript Types

```typescript
export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface CreateTodoDto {
  title: string
  due_date?: string | null
}

export interface UpdateTodoDto {
  title?: string
  completed?: boolean
  due_date?: string | null
}
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `title` | Non-empty after trim, max 500 chars | "Title is required" / "Title too long" |
| `due_date` | Must be ISO8601 and ≥ now + 1 minute (Singapore TZ) | "Due date must be at least 1 minute in the future" |

### API Endpoints

#### `POST /api/todos`
- Request body: `{ title: string, due_date?: string }`
- Response `201`: created todo object
- Response `400`: validation error

#### `GET /api/todos`
- Query params: none for now (filtering in Feature 08)
- Response `200`: `{ todos: Todo[] }` sorted by `due_date ASC, created_at ASC`

#### `GET /api/todos/[id]`
- Response `200`: single todo
- Response `404`: not found

#### `PUT /api/todos/[id]`
- Request body: `UpdateTodoDto` (partial)
- Response `200`: updated todo
- Response `400` / `404`

#### `DELETE /api/todos/[id]`
- Response `204`: no content
- Response `404`: not found

---

## Singapore Timezone (`lib/timezone.ts`)

```typescript
// Always use these functions — NEVER use new Date() directly
export function getSingaporeNow(): Date      // current time in SGT
export function toSingaporeISO(date: Date): string  // ISO string with SGT offset
export function isFutureDate(dateStr: string): boolean  // at least 1 min in future
```

All due dates stored as ISO8601 strings and interpreted in Asia/Singapore.

---

## UI Components (`app/page.tsx`)

### Layout Sections (client component `'use client'`)

```
[Add Todo Form]
  Title input | Add button

[Filter Bar]
  (placeholder — wired in Feature 08)

[Overdue Section]     (red header, ⚠ badge)
  Todo card × N

[Active Section]      (default header)
  Todo card × N

[Completed Section]   (muted header, toggle show/hide)
  Todo card × N
```

### Todo Card

```
☐ [Title]          [due badge]   [Edit] [Delete]
```

### Edit Modal

Pre-filled form overlay with Save / Cancel.

### Delete Confirmation

Simple `window.confirm` or inline prompt before `DELETE`.

---

## Validation Zod Schema

```typescript
import { z } from 'zod'

export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500).transform(s => s.trim()),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
})

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(500).transform(s => s.trim()).optional(),
  completed: z.boolean().optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
})
```

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Title is whitespace only | Reject with "Title is required" |
| Due date in the past | Reject with "Due date must be in the future" |
| Due date exactly now | Reject (needs 1 minute buffer) |
| Update non-existent todo | Return 404 |
| Delete non-existent todo | Return 404 |
| No todos in DB | Return empty array `{ todos: [] }` |
| Title 501 chars | Reject with "Title too long" |

---

## Acceptance Criteria

- [ ] Can create todo with just a title (no due date)
- [ ] Can create todo with a future due date (SGT validated)
- [ ] Title-only whitespace is rejected
- [ ] Past due date is rejected
- [ ] All todos returned sorted by due_date ASC then created_at ASC
- [ ] Toggling completion moves todo to correct section
- [ ] Edit saves changes and refreshes list
- [ ] Delete removes todo from list
- [ ] Overdue todos (due_date < now) appear in Overdue section
- [ ] Completed todos appear in Completed section

---

## Testing Requirements

### Unit Tests (`__tests__/lib/`)

| Test | Target |
|------|--------|
| `timezone.test.ts` | `getSingaporeNow`, `isFutureDate` |
| `db.test.ts` | `todoDB.create`, `.findAll`, `.findById`, `.update`, `.delete` |
| `validation.test.ts` | createTodoSchema, updateTodoSchema parse/rejection |

### API Integration Tests (`__tests__/api/`)

| Test | Target |
|------|--------|
| `todos.test.ts` | POST create, GET list, GET by id, PUT update, DELETE |

### E2E Tests (Playwright) (`tests/`)

| Test | Target |
|------|--------|
| `01-todo-crud.spec.ts` | full CRUD user journey in browser |

---

## Out of Scope (deferred to other PRPs)

- Priority levels → Feature 02
- Recurring patterns → Feature 03
- Reminders → Feature 04
- Subtasks → Feature 05
- Tags → Feature 06
- Authentication → Feature 11 (user_id defaults to 1)

---

## Success Metrics

- All unit tests pass
- All API integration tests pass
- All E2E CRUD flows pass
- 80%+ code coverage on `lib/db.ts` and `lib/timezone.ts`
- No TypeScript errors
- `npm run build` succeeds
