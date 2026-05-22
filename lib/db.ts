import Database from 'better-sqlite3'
import path from 'path'
import { calculateNextDueDate, type RecurrencePattern } from './timezone'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  user_id?: number
}

export interface UpdateTodoDto {
  title?: string
  completed?: boolean
  due_date?: string | null
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
}

export interface TodoUpdateResult {
  todo: Todo
  next_instance: Todo | null
}

// Raw row from SQLite (integers for booleans)
interface TodoRow {
  id: number
  user_id: number
  title: string
  completed: number
  due_date: string | null
  is_recurring: number
  recurrence_pattern: RecurrencePattern | null
  created_at: string
  updated_at: string
}

// ─── Database initialisation ──────────────────────────────────────────────────

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'todos.db')
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
  }
  return _db
}

/** Exposed for test teardown — closes and resets the singleton */
export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

function initSchema(db: Database.Database): void {
  const isDuplicateColumnError = (error: unknown): boolean =>
    error instanceof Error && /duplicate column name/i.test(error.message)

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL DEFAULT 1,
      title      TEXT    NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      due_date   TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
  `)

  // Migration-safe column additions for existing DBs created before recurrence support.
  try {
    db.exec("ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0")
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error
    }
  }

  try {
    db.exec('ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT')
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error
    }
  }

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_todos_recurring ON todos(user_id, is_recurring, due_date)',
  )
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: TodoRow): Todo {
  return {
    ...row,
    completed: row.completed === 1,
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: row.recurrence_pattern ?? null,
  }
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

export const todoDB = {
  /**
   * Create a new todo.
   * Returns the newly created todo with its generated id.
   */
  create(dto: CreateTodoDto): Todo {
    const db = getDb()
    const stmt = db.prepare<[string, number, string | null, number, RecurrencePattern | null]>(`
      INSERT INTO todos (title, user_id, due_date, is_recurring, recurrence_pattern)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `)
    const isRecurring = dto.is_recurring ?? false
    const row = stmt.get(
      dto.title,
      dto.user_id ?? 1,
      dto.due_date ?? null,
      isRecurring ? 1 : 0,
      isRecurring ? (dto.recurrence_pattern ?? null) : null,
    ) as TodoRow
    return mapRow(row)
  },

  /**
   * Return all todos for a user, sorted by due_date ASC (nulls last), then created_at ASC.
   */
  findAll(user_id = 1): Todo[] {
    const db = getDb()
    const stmt = db.prepare<[number]>(`
      SELECT * FROM todos
      WHERE user_id = ?
      ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        created_at ASC
    `)
    const rows = stmt.all(user_id) as TodoRow[]
    return rows.map(mapRow)
  },

  /**
   * Find a single todo by id (for a given user).
   * Returns null when not found.
   */
  findById(id: number, user_id = 1): Todo | null {
    const db = getDb()
    const stmt = db.prepare<[number, number]>(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    )
    const row = stmt.get(id, user_id) as TodoRow | undefined
    return row ? mapRow(row) : null
  },

  /**
   * Partially update a todo.
   * Returns the updated todo, or null if not found.
   */
  update(id: number, dto: UpdateTodoDto, user_id = 1): Todo | null {
    const db = getDb()

    const fields: string[] = []
    const values: (string | number | null | RecurrencePattern)[] = []

    if (dto.title !== undefined) {
      fields.push('title = ?')
      values.push(dto.title)
    }
    if (dto.completed !== undefined) {
      fields.push('completed = ?')
      values.push(dto.completed ? 1 : 0)
    }
    if (dto.due_date !== undefined) {
      fields.push('due_date = ?')
      values.push(dto.due_date)
    }
    if (dto.is_recurring !== undefined) {
      fields.push('is_recurring = ?')
      values.push(dto.is_recurring ? 1 : 0)
    }
    if (dto.recurrence_pattern !== undefined) {
      fields.push('recurrence_pattern = ?')
      values.push(dto.recurrence_pattern)
    }

    if (fields.length === 0) return this.findById(id, user_id)

    fields.push("updated_at = datetime('now')")
    values.push(id, user_id)

    const stmt = db.prepare<(string | number | null)[]>(`
      UPDATE todos
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
      RETURNING *
    `)
    const row = stmt.get(...values) as TodoRow | undefined
    return row ? mapRow(row) : null
  },

  /**
   * Update a todo and, when it transitions to completed and is recurring,
   * generate the next instance atomically in the same transaction.
   */
  updateWithRecurring(id: number, dto: UpdateTodoDto, user_id = 1): TodoUpdateResult | null {
    const db = getDb()

    const transaction = db.transaction((todoId: number, patch: UpdateTodoDto, scopedUserId: number) => {
      const existingStmt = db.prepare<[number, number]>(
        'SELECT * FROM todos WHERE id = ? AND user_id = ?',
      )
      const existingRow = existingStmt.get(todoId, scopedUserId) as TodoRow | undefined
      if (!existingRow) return null

      const existingTodo = mapRow(existingRow)
      const updatedTodo = this.update(todoId, patch, scopedUserId)
      if (!updatedTodo) return null

      let nextInstance: Todo | null = null
      const transitionedToCompleted = !existingTodo.completed && updatedTodo.completed

      if (transitionedToCompleted && updatedTodo.is_recurring) {
        if (!updatedTodo.due_date || !updatedTodo.recurrence_pattern) {
          throw new Error('Recurring todos require due_date and recurrence_pattern to generate next instance')
        }

        const nextDueDate = calculateNextDueDate(
          updatedTodo.due_date,
          updatedTodo.recurrence_pattern,
        )

        nextInstance = this.create({
          title: updatedTodo.title,
          user_id: updatedTodo.user_id,
          due_date: nextDueDate,
          is_recurring: updatedTodo.is_recurring,
          recurrence_pattern: updatedTodo.recurrence_pattern,
        })
      }

      return {
        todo: updatedTodo,
        next_instance: nextInstance,
      }
    })

    return transaction(id, dto, user_id)
  },

  /**
   * Delete a todo by id.
   * Returns true when a row was deleted, false when not found.
   */
  delete(id: number, user_id = 1): boolean {
    const db = getDb()
    const stmt = db.prepare<[number, number]>(
      'DELETE FROM todos WHERE id = ? AND user_id = ?',
    )
    const result = stmt.run(id, user_id)
    return result.changes > 0
  },
}
