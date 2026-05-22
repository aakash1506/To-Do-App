import Database from 'better-sqlite3'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  created_at: string
  updated_at: string
  tags: Tag[]
}

export interface Tag {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface CreateTodoDto {
  title: string
  due_date?: string | null
  user_id?: number
  tag_ids?: number[]
}

export interface UpdateTodoDto {
  title?: string
  completed?: boolean
  due_date?: string | null
  tag_ids?: number[]
}

export interface CreateTagDto {
  name: string
  color: string
  user_id?: number
}

export interface UpdateTagDto {
  name?: string
  color?: string
}

// Raw row from SQLite (integers for booleans)
interface TodoRow {
  id: number
  user_id: number
  title: string
  completed: number
  due_date: string | null
  created_at: string
  updated_at: string
}

interface TagRow {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
  updated_at: string
}

interface TodoTagRow extends TagRow {
  todo_id: number
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
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL DEFAULT 1,
      title      TEXT    NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      due_date   TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL DEFAULT 1,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL,
      tag_id  INTEGER NOT NULL,
      PRIMARY KEY (todo_id, tag_id),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name_unique
      ON tags(user_id, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
  `)
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: TodoRow): Todo {
  return {
    ...row,
    completed: row.completed === 1,
    tags: [],
  }
}

function mapTagRow(row: TagRow): Tag {
  return {
    ...row,
  }
}

function uniqueTagIds(tagIds: number[]): number[] {
  return [...new Set(tagIds.filter((id) => Number.isInteger(id) && id > 0))]
}

function loadTodoTags(
  db: Database.Database,
  todoIds: number[],
): Map<number, Tag[]> {
  if (todoIds.length === 0) return new Map()

  const placeholders = todoIds.map(() => '?').join(',')
  const stmt = db.prepare<(number | string)[]>(`
    SELECT
      tt.todo_id,
      t.id,
      t.user_id,
      t.name,
      t.color,
      t.created_at,
      t.updated_at
    FROM todo_tags tt
    INNER JOIN tags t ON t.id = tt.tag_id
    WHERE tt.todo_id IN (${placeholders})
    ORDER BY t.name COLLATE NOCASE ASC
  `)

  const rows = stmt.all(...todoIds) as TodoTagRow[]
  return rows.reduce((acc, row) => {
    const current = acc.get(row.todo_id) ?? []
    const next = [...current, mapTagRow(row)]
    acc.set(row.todo_id, next)
    return acc
  }, new Map<number, Tag[]>())
}

function assertUserTagIds(
  db: Database.Database,
  user_id: number,
  tagIds: number[],
): void {
  if (tagIds.length === 0) return

  const placeholders = tagIds.map(() => '?').join(',')
  const stmt = db.prepare<(number | string)[]>(`
    SELECT id
    FROM tags
    WHERE user_id = ?
      AND id IN (${placeholders})
  `)

  const rows = stmt.all(user_id, ...tagIds) as Array<{ id: number }>
  const foundIds = new Set(rows.map((row) => row.id))
  const hasMissingTag = tagIds.some((id) => !foundIds.has(id))

  if (hasMissingTag) {
    throw new Error('One or more tags do not exist')
  }
}

function replaceTodoTags(
  db: Database.Database,
  todoId: number,
  user_id: number,
  tagIds: number[],
): void {
  const uniqueIds = uniqueTagIds(tagIds)
  assertUserTagIds(db, user_id, uniqueIds)

  const clearStmt = db.prepare<[number]>('DELETE FROM todo_tags WHERE todo_id = ?')
  const insertStmt = db.prepare<[number, number]>(
    'INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)',
  )

  clearStmt.run(todoId)
  uniqueIds.forEach((tagId) => {
    insertStmt.run(todoId, tagId)
  })
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

export const todoDB = {
  /**
   * Create a new todo.
   * Returns the newly created todo with its generated id.
   */
  create(dto: CreateTodoDto): Todo {
    const db = getDb()
    const userId = dto.user_id ?? 1
    const stmt = db.prepare<[string, number, string | null]>(`
      INSERT INTO todos (title, user_id, due_date)
      VALUES (?, ?, ?)
      RETURNING *
    `)

    const createTodo = db.transaction((payload: CreateTodoDto) => {
      if (payload.tag_ids !== undefined) {
        assertUserTagIds(db, userId, uniqueTagIds(payload.tag_ids))
      }

      const row = stmt.get(
        payload.title,
        userId,
        payload.due_date ?? null,
      ) as TodoRow

      if (payload.tag_ids !== undefined) {
        replaceTodoTags(db, row.id, userId, payload.tag_ids)
      }

      return row.id
    })

    const createdTodoId = createTodo(dto)
    const created = this.findById(createdTodoId, userId)
    if (!created) {
      throw new Error('Failed to load created todo')
    }

    return created
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
    const todos = rows.map(mapRow)
    const todoTags = loadTodoTags(
      db,
      todos.map((todo) => todo.id),
    )

    return todos.map((todo) => ({
      ...todo,
      tags: todoTags.get(todo.id) ?? [],
    }))
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
    if (!row) return null

    const todo = mapRow(row)
    const todoTags = loadTodoTags(db, [todo.id])
    return {
      ...todo,
      tags: todoTags.get(todo.id) ?? [],
    }
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

    if (fields.length === 0 && dto.tag_ids === undefined) {
      return this.findById(id, user_id)
    }

    if (fields.length === 0 && dto.tag_ids !== undefined) {
      const existing = this.findById(id, user_id)
      if (!existing) return null

      const updateTagsOnly = db.transaction((tagIds: number[]) => {
        replaceTodoTags(db, id, user_id, tagIds)
      })
      updateTagsOnly(dto.tag_ids)
      return this.findById(id, user_id)
    }

    fields.push("updated_at = datetime('now')")
    values.push(id, user_id)

    const stmt = db.prepare<(string | number | null)[]>(`
      UPDATE todos
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
      RETURNING *
    `)
    const updateTodo = db.transaction((input: UpdateTodoDto) => {
      if (input.tag_ids !== undefined) {
        assertUserTagIds(db, user_id, uniqueTagIds(input.tag_ids))
      }

      const row = stmt.get(...values) as TodoRow | undefined
      if (!row) return null

      if (input.tag_ids !== undefined) {
        replaceTodoTags(db, id, user_id, input.tag_ids)
      }

      return row.id
    })

    const updatedId = updateTodo(dto)
    if (!updatedId) return null

    return this.findById(updatedId, user_id)
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

export const tagDB = {
  create(dto: CreateTagDto): Tag {
    const db = getDb()
    const stmt = db.prepare<[string, string, number]>(`
      INSERT INTO tags (name, color, user_id)
      VALUES (?, ?, ?)
      RETURNING *
    `)

    const row = stmt.get(dto.name, dto.color, dto.user_id ?? 1) as TagRow
    return mapTagRow(row)
  },

  findAll(user_id = 1): Tag[] {
    const db = getDb()
    const stmt = db.prepare<[number]>(`
      SELECT *
      FROM tags
      WHERE user_id = ?
      ORDER BY name COLLATE NOCASE ASC
    `)

    const rows = stmt.all(user_id) as TagRow[]
    return rows.map(mapTagRow)
  },

  findById(id: number, user_id = 1): Tag | null {
    const db = getDb()
    const stmt = db.prepare<[number, number]>(
      'SELECT * FROM tags WHERE id = ? AND user_id = ?',
    )

    const row = stmt.get(id, user_id) as TagRow | undefined
    return row ? mapTagRow(row) : null
  },

  update(id: number, dto: UpdateTagDto, user_id = 1): Tag | null {
    const db = getDb()
    const fields: string[] = []
    const values: (string | number)[] = []

    if (dto.name !== undefined) {
      fields.push('name = ?')
      values.push(dto.name)
    }

    if (dto.color !== undefined) {
      fields.push('color = ?')
      values.push(dto.color)
    }

    if (fields.length === 0) return this.findById(id, user_id)

    fields.push("updated_at = datetime('now')")
    values.push(id, user_id)

    const stmt = db.prepare<(string | number)[]>(`
      UPDATE tags
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
      RETURNING *
    `)

    const row = stmt.get(...values) as TagRow | undefined
    return row ? mapTagRow(row) : null
  },

  delete(id: number, user_id = 1): boolean {
    const db = getDb()
    const stmt = db.prepare<[number, number]>(
      'DELETE FROM tags WHERE id = ? AND user_id = ?',
    )
    const result = stmt.run(id, user_id)
    return result.changes > 0
  },
}
