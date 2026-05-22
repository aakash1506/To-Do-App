# PRP 03 - Recurring Todos

## Feature Overview

Implement recurring todos with four patterns: `daily`, `weekly`, `monthly`, and `yearly`.

This feature extends Feature 01 (Todo CRUD) and integrates with Feature 02 (Priority). A recurring todo must automatically create the next instance when the current instance is marked complete.

All recurrence calculations must follow Singapore timezone (`Asia/Singapore`).

---

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-03-01 | user | mark a todo as recurring | I can automate repeating tasks |
| US-03-02 | user | choose daily/weekly/monthly/yearly patterns | recurrence matches my real schedule |
| US-03-03 | user | require due date for recurring todos | next occurrence can be calculated reliably |
| US-03-04 | user | automatically get the next instance on completion | I do not need to re-create recurring tasks manually |
| US-03-05 | user | keep metadata on generated instances | recurring tasks remain consistent over time |
| US-03-06 | user | see a clear recurring badge in the UI | I can distinguish recurring vs one-time tasks |

---

## User Flow

```text
1. User enters title in Add Todo form
2. User checks Repeat and selects recurrence pattern
3. User sets a due date (required for recurring)
4. POST /api/todos creates todo with recurrence metadata
5. Todo displays recurring badge (e.g., "R weekly")
6. User marks todo as complete
7. PUT /api/todos/[id] marks current row completed
8. Server creates a new todo instance with next due date
9. New instance appears in active list with same recurrence metadata
```

---

## Technical Requirements

### Dependencies

- Requires Feature 01 (CRUD) fully implemented
- Assumes Feature 02 (Priority) may already exist and should be preserved on cloned instances

### Database Schema (`lib/db.ts`)

Add recurrence columns to `todos` and migration logic for existing DB files.

```sql
-- New columns (add via migration-safe ALTER TABLE)
ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT;

-- Optional CHECK on fresh table creation
recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL)

-- Recommended index
CREATE INDEX IF NOT EXISTS idx_todos_recurring ON todos(user_id, is_recurring, due_date);
```

Migration behavior:
- Existing rows default to `is_recurring = 0` and `recurrence_pattern = NULL`
- Migration must be idempotent (safe to run repeatedly)

### TypeScript Types (`lib/db.ts`)

```typescript
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  created_at: string
  updated_at: string
}

export interface CreateTodoDto {
  title: string
  due_date?: string | null
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
}

export interface UpdateTodoDto {
  title?: string
  completed?: boolean
  due_date?: string | null
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
}
```

Security and tenancy rule:
- `user_id` is server-owned, never accepted from client payloads
- API handlers must always scope DB reads/writes with `session.userId`

### Validation Rules (`lib/validation.ts`)

| Rule | Expected Behavior |
|------|-------------------|
| `is_recurring = true` requires `due_date` | Reject with `Recurring todos require a due date` |
| `is_recurring = true` requires `recurrence_pattern` | Reject with `Recurrence pattern is required` |
| `is_recurring = false` + pattern set | Reject with `Recurrence pattern requires Repeat enabled` |
| `recurrence_pattern` value not in allowed enum | Reject with `Invalid recurrence pattern` |
| due date must still be valid future ISO datetime when creating | Keep Feature 01 rules |

Recommended Zod definitions:

```typescript
const recurrencePatternSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly'])

const recurrenceFields = {
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrencePatternSchema.nullable().optional(),
}
```

For `PUT` updates, validate against effective merged values (existing row + patch), not only the partial payload.

Validation boundary:
- Future-date validation applies to client-submitted create/update payloads
- Server-generated `next_instance` rows may have past due dates when a recurring todo is completed late

### Recurrence Calculation Logic (`lib/timezone.ts`)

Add helper to compute next due date based on the current todo due date.

```typescript
export function calculateNextDueDate(
  currentDueISO: string,
  pattern: RecurrencePattern,
): string
```

Rules:
- Always calculate from current instance `due_date`, not completion timestamp
- Preserve wall-clock time in Singapore timezone
- `daily`: +1 calendar day
- `weekly`: +7 calendar days
- `monthly`: same day next month, clamp to month end if needed
- `yearly`: same month/day next year, clamp Feb 29 to Feb 28 on non-leap years
- Return ISO string with Singapore offset (`+08:00`)

Examples:
- `2026-05-22T09:00:00+08:00` daily -> `2026-05-23T09:00:00+08:00`
- `2026-01-31T18:30:00+08:00` monthly -> `2026-02-28T18:30:00+08:00`
- `2028-02-29T10:00:00+08:00` yearly -> `2029-02-28T10:00:00+08:00`

### API Contract Updates

#### API Route Pattern (mandatory)

All recurring endpoints must follow project API conventions:

```typescript
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Parse + validate body
  // Use session.userId for all DB operations
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  // Validate id, merge existing + patch, update with session.userId scope
}
```

Rules:
- Always auth-check first
- Always `await params` in dynamic routes
- Always use `session.userId` for create/find/update/delete
- Ignore or reject client-supplied `user_id` fields

#### `POST /api/todos`

Request body:

```json
{
  "title": "Pay rent",
  "due_date": "2026-05-31T09:00:00+08:00",
  "is_recurring": true,
  "recurrence_pattern": "monthly"
}
```

Behavior:
- Create recurring todo when recurrence fields are valid
- Reject invalid recurrence combinations with status `400`
- Derive `user_id` from session only (never from client body)

#### `PUT /api/todos/[id]`

Recurring-completion behavior:
- If todo transitions from `completed=false` to `completed=true`
- And `is_recurring=true`
- Then create next instance automatically
- Exactly one next instance is created per completion action (no catch-up loop)

Important idempotency rule:
- Do not create another next instance if the todo is already completed

Canonical response shape:

```json
{
  "todo": { "id": 42, "completed": true },
  "next_instance": { "id": 43, "completed": false }
}
```

When no new instance is generated, return:

```json
{
  "todo": { "id": 42, "completed": true },
  "next_instance": null
}
```

### Metadata Inheritance Rules

When generating `next_instance`, copy:
- `title`
- `user_id` (from current todo/session scope)
- `is_recurring`
- `recurrence_pattern`
- `priority` (if Feature 02 fields exist)
- `reminder_minutes` (when Feature 04 is implemented)
- tag relationships (when Feature 06 is implemented)

Always set:
- `completed = false`
- `due_date = calculateNextDueDate(previous_due_date, recurrence_pattern)`
- `created_at`/`updated_at` generated by DB defaults

### Transaction Safety

Recurring completion must be atomic:
- Mark current todo complete
- Create next instance

Use a SQLite transaction (`better-sqlite3`) so partial writes cannot occur.

---

## UI Components (`app/page.tsx`)

### Create Form

Add recurrence controls:
- `Repeat` checkbox (`is_recurring`)
- `Recurrence Pattern` dropdown (enabled only when repeat is checked)
  - Daily
  - Weekly
  - Monthly
  - Yearly

Client-side guardrails:
- If `Repeat` is checked, due date is required
- Show inline error near form controls

### Edit Modal

Add same recurrence controls in edit flow:
- Pre-fill existing recurring values
- Allow turning recurrence on/off
- If turning on recurrence, require due date + pattern

### Todo Card

Display recurrence badge for recurring todos:
- Example text: `R daily`, `R weekly`
- Position near due date/priority badges

### Completion UX

When recurring todo is completed:
- Keep completed instance in Completed section
- Show generated next instance in Active section without full page refresh

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Recurring todo created without due date | `400` validation error |
| Recurring todo created without pattern | `400` validation error |
| Non-recurring todo with pattern set | `400` validation error |
| Marking already-completed recurring todo complete again | No new instance created |
| Monthly recurrence from day 29/30/31 | Clamp to valid day in target month |
| Yearly recurrence from Feb 29 | Clamp to Feb 28 on non-leap year |
| User completes overdue recurring todo weeks late | Create only one next instance from prior due date (no multi-backfill) |
| Generated next instance due date is still in the past (late completion) | Allow creation; do not fail recurrence transaction |
| Existing corrupted data (`is_recurring=true`, `due_date=NULL`) | Prevent generation and return safe error |
| Completion request fails after update but before clone | Transaction rollback, no partial state |

---

## Acceptance Criteria

- [ ] User can create recurring todo with valid due date and pattern
- [ ] User cannot create recurring todo without due date
- [ ] User cannot create recurring todo without recurrence pattern
- [ ] Recurring badge appears on recurring items
- [ ] Completing recurring todo creates exactly one next instance
- [ ] Completing an overdue recurring todo still creates only one next instance (no catch-up chain)
- [ ] Next instance due date is correctly computed for all 4 patterns
- [ ] Monthly/yearly edge cases (month-end, leap day) are handled correctly
- [ ] Generated next instance preserves recurrence metadata
- [ ] Generated next instance preserves available extended metadata (priority now; reminders/tags when present)
- [ ] Build, lint, and tests pass after implementation

---

## Testing Requirements

### Unit Tests (`__tests__/lib/`)

Add/extend tests for:
- `calculateNextDueDate` for all patterns
- month-end clamp logic
- leap-year handling
- recurrence validation schema combinations

Suggested files:
- `__tests__/lib/timezone.test.ts` (new test cases)
- `__tests__/lib/validation.test.ts` (new recurrence test cases)
- `__tests__/lib/db.test.ts` (recurrence column persistence)

### API Integration Tests (`__tests__/api/todos.test.ts`)

Add cases for:
- create recurring todo (success)
- create recurring todo missing due date/pattern (400)
- completing recurring todo generates next instance
- completing non-recurring todo does not generate next instance
- idempotent completion (no duplicate next instance)

### E2E Tests (`tests/`)

Create:
- `tests/03-recurring-todos.spec.ts`

Cover flows:
- create recurring todo from UI
- complete recurring todo and observe new instance
- edit recurrence settings
- verify badge visibility and section placement

---

## Out of Scope

- Reminder scheduling internals (Feature 04)
- Tag CRUD and tag filtering (Feature 06)
- Template generation from recurrence (Feature 07)
- Calendar visualization logic (Feature 10)

(Compatibility hooks for reminder/tag inheritance should be designed but full behavior lands in those features.)

---

## Success Metrics

- 100% pass rate for recurring unit tests (`calculateNextDueDate`, validation, month-end/leap-year cases)
- 100% pass rate for recurring API integration tests (create validation, idempotent completion, next-instance generation)
- 0 duplicate next-instance rows in idempotency test scenarios
- Recurring E2E journey passes in Playwright with no flaky retries
- `npm run lint` and `npm run build` succeed after implementation
