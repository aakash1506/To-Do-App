import Database from 'better-sqlite3'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
}

export interface CreateTodoDto {
  title: string
  due_date?: string | null
  reminder_minutes?: number | null
  user_id?: number
}

export interface UpdateTodoDto {
  title?: string
  completed?: boolean
  due_date?: string | null
  reminder_minutes?: number | null
}

// Raw row from SQLite (integers for booleans)
interface TodoRow {
  id: number
  user_id: number
  title: string
  completed: number
  due_date: string | null
  reminder_minutes: number | null
  last_notification_sent: string | null
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id                INTEGER NOT NULL DEFAULT 1,
      title                  TEXT    NOT NULL,
      completed              INTEGER NOT NULL DEFAULT 0,
      due_date               TEXT,
      reminder_minutes       INTEGER,
      last_notification_sent TEXT,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
  `)

  // Idempotent migrations for existing databases
  const migrations = [
    `ALTER TABLE todos ADD COLUMN reminder_minutes       INTEGER`,
    `ALTER TABLE todos ADD COLUMN last_notification_sent TEXT`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: TodoRow): Todo {
  return {
    ...row,
    completed: row.completed === 1,
    reminder_minutes: row.reminder_minutes ?? null,
    last_notification_sent: row.last_notification_sent ?? null,
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
    const stmt = db.prepare<[string, number, string | null, number | null]>(`
      INSERT INTO todos (title, user_id, due_date, reminder_minutes)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `)
    const row = stmt.get(
      dto.title,
      dto.user_id ?? 1,
      dto.due_date ?? null,
      dto.reminder_minutes ?? null,
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
    const values: (string | number | null)[] = []

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
    if (dto.reminder_minutes !== undefined) {
      fields.push('reminder_minutes = ?')
      values.push(dto.reminder_minutes)
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
   * Find todos that are due for a browser notification:
   *   - not completed
   *   - has due_date and reminder_minutes
   *   - (due_date - reminder_minutes) <= now
   *   - last_notification_sent IS NULL
   * Side-effect: sets last_notification_sent = datetime('now') for returned rows.
   */
  findDueForNotification(user_id = 1): Todo[] {
    const db = getDb()
    const rows = db.prepare<[number]>(`
      SELECT * FROM todos
      WHERE user_id = ?
        AND completed = 0
        AND due_date IS NOT NULL
        AND reminder_minutes IS NOT NULL
        AND last_notification_sent IS NULL
        AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime('now')
    `).all(user_id) as TodoRow[]

    if (rows.length > 0) {
      const placeholders = rows.map(() => '?').join(',')
      db.prepare(`
        UPDATE todos
        SET last_notification_sent = datetime('now'),
            updated_at = datetime('now')
        WHERE id IN (${placeholders})
      `).run(...rows.map((r) => r.id))
    }

    return rows.map(mapRow)
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
