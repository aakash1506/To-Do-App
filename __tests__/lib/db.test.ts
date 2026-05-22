import path from 'path'
import os from 'os'
import fs from 'fs'
import Database from 'better-sqlite3'

// Use an in-memory or temp database for tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-test-'))
const testDbPath = path.join(tmpDir, 'test.db')
process.env.DB_PATH = testDbPath

import { todoDB, tagDB, closeDb, getDb } from '@/lib/db'

describe('todoDB', () => {
  beforeEach(() => {
    // Clear todos table before each test
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  afterAll(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a todo with just a title', () => {
      const todo = todoDB.create({ title: 'Buy groceries' })

      expect(todo.id).toBeGreaterThan(0)
      expect(todo.title).toBe('Buy groceries')
      expect(todo.completed).toBe(false)
      expect(todo.due_date).toBeNull()
      expect(todo.user_id).toBe(1)
      expect(todo.created_at).toBeTruthy()
      expect(todo.updated_at).toBeTruthy()
    })

    it('creates a todo with a due date', () => {
      const dueDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const todo = todoDB.create({ title: 'Meeting', due_date: dueDate })

      expect(todo.due_date).toBe(dueDate)
    })

    it('creates a todo with a specific user_id', () => {
      const todo = todoDB.create({ title: 'User 2 task', user_id: 2 })
      expect(todo.user_id).toBe(2)
    })

    it('returns the todo with completed: false by default', () => {
      const todo = todoDB.create({ title: 'New task' })
      expect(todo.completed).toBe(false)
    })

    it('defaults priority to medium', () => {
      const todo = todoDB.create({ title: 'Default priority task' })
      expect(todo.priority).toBe('medium')
    })

    it('creates a todo with explicit priority', () => {
      const todo = todoDB.create({ title: 'Urgent task', priority: 'high' })
      expect(todo.priority).toBe('high')
    })

    it('assigns incrementing ids', () => {
      const a = todoDB.create({ title: 'First' })
      const b = todoDB.create({ title: 'Second' })
      expect(b.id).toBeGreaterThan(a.id)
    })

    it('creates a todo with tags', () => {
      const work = tagDB.create({ name: 'Work', color: '#2563EB' })
      const urgent = tagDB.create({ name: 'Urgent', color: '#EF4444' })

      const todo = todoDB.create({
        title: 'Prepare report',
        tag_ids: [work.id, urgent.id],
      })

      expect(todo.tags).toHaveLength(2)
      expect(todo.tags.map((tag) => tag.name).sort()).toEqual(['Urgent', 'Work'])
    })

    it('does not create todo when tag assignment is invalid', () => {
      expect(() => {
        todoDB.create({ title: 'Should fail', tag_ids: [99999] })
      }).toThrow(/do not exist/i)

      expect(todoDB.findAll()).toHaveLength(0)
    })
  })

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns empty array when no todos exist', () => {
      expect(todoDB.findAll()).toEqual([])
    })

    it('returns all todos for a user', () => {
      todoDB.create({ title: 'A' })
      todoDB.create({ title: 'B' })
      expect(todoDB.findAll()).toHaveLength(2)
    })

    it('only returns todos for the specified user', () => {
      todoDB.create({ title: 'User 1 task', user_id: 1 })
      todoDB.create({ title: 'User 2 task', user_id: 2 })

      expect(todoDB.findAll(1)).toHaveLength(1)
      expect(todoDB.findAll(2)).toHaveLength(1)
    })

    it('sorts todos with due dates before those without', () => {
      todoDB.create({ title: 'No due date' })
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      todoDB.create({ title: 'Has due date', due_date: future })

      const todos = todoDB.findAll()
      expect(todos[0].title).toBe('Has due date')
      expect(todos[1].title).toBe('No due date')
    })

    it('sorts todos with earlier due dates first', () => {
      const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      const sooner = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
      todoDB.create({ title: 'Later', due_date: later })
      todoDB.create({ title: 'Sooner', due_date: sooner })

      const todos = todoDB.findAll()
      expect(todos[0].title).toBe('Sooner')
      expect(todos[1].title).toBe('Later')
    })

    it('sorts by priority before due date', () => {
      const soon = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
      const later = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()

      todoDB.create({ title: 'Low first by date', priority: 'low', due_date: soon })
      todoDB.create({ title: 'High later by date', priority: 'high', due_date: later })

      const todos = todoDB.findAll()
      expect(todos[0].title).toBe('High later by date')
      expect(todos[1].title).toBe('Low first by date')
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('finds a todo by id', () => {
      const created = todoDB.create({ title: 'Find me' })
      const found = todoDB.findById(created.id)

      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect(found!.title).toBe('Find me')
    })

    it('returns null for a non-existent id', () => {
      expect(todoDB.findById(99999)).toBeNull()
    })

    it('returns null when the todo belongs to another user', () => {
      const todo = todoDB.create({ title: 'Private', user_id: 2 })
      expect(todoDB.findById(todo.id, 1)).toBeNull()
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the title', () => {
      const todo = todoDB.create({ title: 'Old title' })
      const updated = todoDB.update(todo.id, { title: 'New title' })

      expect(updated).not.toBeNull()
      expect(updated!.title).toBe('New title')
    })

    it('marks a todo as completed', () => {
      const todo = todoDB.create({ title: 'Task' })
      const updated = todoDB.update(todo.id, { completed: true })

      expect(updated!.completed).toBe(true)
    })

    it('marks a completed todo as incomplete', () => {
      const todo = todoDB.create({ title: 'Task' })
      todoDB.update(todo.id, { completed: true })
      const updated = todoDB.update(todo.id, { completed: false })

      expect(updated!.completed).toBe(false)
    })

    it('updates due_date', () => {
      const todo = todoDB.create({ title: 'Task' })
      const newDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      const updated = todoDB.update(todo.id, { due_date: newDate })

      expect(updated!.due_date).toBe(newDate)
    })

    it('clears due_date when set to null', () => {
      const dueDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const todo = todoDB.create({ title: 'Task', due_date: dueDate })
      const updated = todoDB.update(todo.id, { due_date: null })

      expect(updated!.due_date).toBeNull()
    })

    it('updates priority', () => {
      const todo = todoDB.create({ title: 'Task', priority: 'medium' })
      const updated = todoDB.update(todo.id, { priority: 'low' })

      expect(updated).not.toBeNull()
      expect(updated!.priority).toBe('low')
    })

    it('returns null for a non-existent id', () => {
      expect(todoDB.update(99999, { title: 'x' })).toBeNull()
    })

    it('does not update other users todos', () => {
      const todo = todoDB.create({ title: 'User 2 task', user_id: 2 })
      const result = todoDB.update(todo.id, { title: 'Hacked' }, 1)
      expect(result).toBeNull()
    })

    it('replaces todo tags when tag_ids is provided', () => {
      const work = tagDB.create({ name: 'Work', color: '#2563EB' })
      const home = tagDB.create({ name: 'Home', color: '#22C55E' })
      const urgent = tagDB.create({ name: 'Urgent', color: '#EF4444' })

      const todo = todoDB.create({ title: 'Task', tag_ids: [work.id, home.id] })
      const updated = todoDB.update(todo.id, { tag_ids: [urgent.id] })

      expect(updated).not.toBeNull()
      expect(updated!.tags).toHaveLength(1)
      expect(updated!.tags[0].name).toBe('Urgent')
    })

    it('throws when assigning non-existent tags', () => {
      const todo = todoDB.create({ title: 'Task' })
      expect(() => todoDB.update(todo.id, { tag_ids: [99999] })).toThrow(
        /do not exist/i,
      )
    })

    it('does not partially update fields when tag assignment fails', () => {
      const todo = todoDB.create({ title: 'Original title' })

      expect(() => {
        todoDB.update(todo.id, { title: 'Changed title', tag_ids: [99999] })
      }).toThrow(/do not exist/i)

      const refreshed = todoDB.findById(todo.id)
      expect(refreshed).not.toBeNull()
      expect(refreshed!.title).toBe('Original title')
    })
  })

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes a todo and returns true', () => {
      const todo = todoDB.create({ title: 'Delete me' })
      expect(todoDB.delete(todo.id)).toBe(true)
      expect(todoDB.findById(todo.id)).toBeNull()
    })

    it('returns false for a non-existent id', () => {
      expect(todoDB.delete(99999)).toBe(false)
    })

    it('does not delete other users todos', () => {
      const todo = todoDB.create({ title: 'User 2 task', user_id: 2 })
      expect(todoDB.delete(todo.id, 1)).toBe(false)
    })
  })

  describe('tagDB', () => {
    it('creates and lists tags', () => {
      tagDB.create({ name: 'Work', color: '#2563EB' })
      tagDB.create({ name: 'Urgent', color: '#EF4444' })

      const tags = tagDB.findAll()
      expect(tags).toHaveLength(2)
      expect(tags.map((tag) => tag.name)).toEqual(['Urgent', 'Work'])
    })

    it('updates a tag', () => {
      const tag = tagDB.create({ name: 'Work', color: '#2563EB' })
      const updated = tagDB.update(tag.id, { name: 'Office', color: '#0EA5E9' })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Office')
      expect(updated!.color).toBe('#0EA5E9')
    })

    it('deletes a tag and detaches from todos', () => {
      const tag = tagDB.create({ name: 'Work', color: '#2563EB' })
      const todo = todoDB.create({ title: 'Task', tag_ids: [tag.id] })
      expect(todo.tags).toHaveLength(1)

      const deleted = tagDB.delete(tag.id)
      expect(deleted).toBe(true)

      const refreshed = todoDB.findById(todo.id)
      expect(refreshed).not.toBeNull()
      expect(refreshed!.tags).toHaveLength(0)
    })
  })
})
