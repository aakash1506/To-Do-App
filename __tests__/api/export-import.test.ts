/**
 * Integration tests for Export and Import API routes.
 */

import path from 'path'
import os from 'os'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-import-api-test-'))
process.env.DB_PATH = path.join(tmpDir, 'export-import-test.db')

import { GET as exportTodos } from '@/app/api/todos/export/route'
import { POST as importTodos } from '@/app/api/todos/import/route'
import { POST as createTodo } from '@/app/api/todos/route'
import { closeDb, getDb, subtaskDB, tagDB } from '@/lib/db'

function makeReq(body: unknown, method = 'POST', url = 'http://localhost'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/todos/export', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM todo_tags')
    getDb().exec('DELETE FROM tags')
    getDb().exec('DELETE FROM subtasks')
    getDb().exec('DELETE FROM todos')
  })

  it('returns 200 with todos array and exportedAt timestamp', async () => {
    const res = await exportTodos()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.todos)).toBe(true)
    expect(body.exportedAt).toBeTruthy()
  })

  it('returns empty todos array when no todos exist', async () => {
    const res = await exportTodos()
    const body = await res.json()
    expect(body.todos).toHaveLength(0)
  })

  it('exports todos with their subtasks and tags', async () => {
    const todoRes = await createTodo(makeReq({ title: 'Export me', priority: 'high' }))
    const todo = await todoRes.json()

    subtaskDB.create(todo.id, 'Step 1', 0)
    const tag = tagDB.create(1, 'Work', '#ff0000')
    tagDB.addToTodo(todo.id, tag.id)

    const res = await exportTodos()
    const body = await res.json()
    expect(body.todos).toHaveLength(1)
    expect(body.todos[0].title).toBe('Export me')
    expect(body.todos[0].priority).toBe('high')
    expect(body.todos[0].subtasks).toHaveLength(1)
    expect(body.todos[0].subtasks[0].title).toBe('Step 1')
    expect(body.todos[0].tags).toHaveLength(1)
    expect(body.todos[0].tags[0].name).toBe('Work')
  })
})

describe('POST /api/todos/import', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM todo_tags')
    getDb().exec('DELETE FROM tags')
    getDb().exec('DELETE FROM subtasks')
    getDb().exec('DELETE FROM todos')
  })

  it('imports todos and returns 201 with count', async () => {
    const req = makeReq({
      todos: [
        { title: 'Imported Task 1' },
        { title: 'Imported Task 2' },
      ],
    })
    const res = await importTodos(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.imported).toBe(2)
    expect(body.ids).toHaveLength(2)
  })

  it('imports a todo with priority and recurrence', async () => {
    const req = makeReq({
      todos: [{ title: 'High priority task', priority: 'high', recurrence_pattern: 'weekly' }],
    })
    const res = await importTodos(req)
    const body = await res.json()
    expect(body.imported).toBe(1)
  })

  it('imports todos with subtasks', async () => {
    const req = makeReq({
      todos: [{
        title: 'Task with subtasks',
        subtasks: [
          { title: 'Step 1', position: 0 },
          { title: 'Step 2', position: 1, completed: true },
        ],
      }],
    })
    const res = await importTodos(req)
    const body = await res.json()
    const [todoId] = body.ids
    const subtasks = subtaskDB.findByTodo(todoId)
    expect(subtasks).toHaveLength(2)
    expect(subtasks[0].title).toBe('Step 1')
    expect(subtasks[1].completed).toBe(true)
  })

  it('imports todos with tags (creates new tags)', async () => {
    const req = makeReq({
      todos: [{
        title: 'Tagged task',
        tags: [{ name: 'Imported', color: '#aabbcc' }],
      }],
    })
    const res = await importTodos(req)
    const body = await res.json()
    const [todoId] = body.ids
    const tags = tagDB.findByTodo(todoId)
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('Imported')
  })

  it('reuses existing tag when name matches', async () => {
    // Pre-create a tag
    tagDB.create(1, 'Existing', '#112233')

    const req = makeReq({
      todos: [{
        title: 'Task',
        tags: [{ name: 'Existing', color: '#000000' }],
      }],
    })
    await importTodos(req)
    // Should not create a duplicate
    const allTags = tagDB.findAll(1)
    expect(allTags.filter((t) => t.name === 'Existing')).toHaveLength(1)
  })

  it('imports a completed todo', async () => {
    const req = makeReq({
      todos: [{ title: 'Done task', completed: true }],
    })
    await importTodos(req)
    const res = await exportTodos()
    const body = await res.json()
    const imported = body.todos.find((t: { title: string }) => t.title === 'Done task')
    expect(imported.completed).toBe(true)
  })

  it('returns 400 for invalid import format', async () => {
    const req = makeReq({ wrong: 'structure' })
    const res = await importTodos(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for todo with empty title', async () => {
    const req = makeReq({ todos: [{ title: '' }] })
    const res = await importTodos(req)
    expect(res.status).toBe(400)
  })

  it('imports an empty todos array successfully', async () => {
    const req = makeReq({ todos: [] })
    const res = await importTodos(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.imported).toBe(0)
  })
})

describe('Export → Import round-trip', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM todo_tags')
    getDb().exec('DELETE FROM tags')
    getDb().exec('DELETE FROM subtasks')
    getDb().exec('DELETE FROM todos')
  })

  it('round-trips todos with subtasks and tags', async () => {
    // Create original data
    const todoRes = await createTodo(makeReq({ title: 'Original task', priority: 'low' }))
    const todo = await todoRes.json()
    subtaskDB.create(todo.id, 'Substep', 0)
    const tag = tagDB.create(1, 'RoundTrip', '#abcdef')
    tagDB.addToTodo(todo.id, tag.id)

    // Export
    const exportRes = await exportTodos()
    const exported = await exportRes.json()

    // Clear everything
    getDb().exec('DELETE FROM todo_tags')
    getDb().exec('DELETE FROM tags')
    getDb().exec('DELETE FROM subtasks')
    getDb().exec('DELETE FROM todos')

    // Import
    const importRes = await importTodos(makeReq(exported))
    expect(importRes.status).toBe(201)
    const importBody = await importRes.json()
    expect(importBody.imported).toBe(1)

    const [newTodoId] = importBody.ids
    const subtasks = subtaskDB.findByTodo(newTodoId)
    const tags = tagDB.findByTodo(newTodoId)

    expect(subtasks[0].title).toBe('Substep')
    expect(tags[0].name).toBe('RoundTrip')
  })
})
