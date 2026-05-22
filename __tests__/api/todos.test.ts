/**
 * Integration tests for Todo API routes.
 * Tests the HTTP layer by calling route handlers directly.
 */

import path from 'path'
import os from 'os'
import fs from 'fs'
import { NextRequest } from 'next/server'

// Use a temp DB for API tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-api-test-'))
process.env.DB_PATH = path.join(tmpDir, 'api-test.db')

import { GET as listTodos, POST as createTodo } from '@/app/api/todos/route'
import {
  GET as getTodo,
  PUT as updateTodo,
  DELETE as deleteTodo,
} from '@/app/api/todos/[id]/route'
import { POST as createTag } from '@/app/api/tags/route'
import { closeDb, getDb } from '@/lib/db'

const futureDate = () => new Date(Date.now() + 5 * 60 * 1000).toISOString()

function makeRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/todos', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string | number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

function makeTagRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/tags', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Global teardown — runs after ALL test suites in this file
afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('POST /api/todos', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('creates a todo with a title and returns 201', async () => {
    const req = makeRequest({ title: 'Test task' })
    const res = await createTodo(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Test task')
    expect(body.completed).toBe(false)
    expect(body.id).toBeGreaterThan(0)
  })

  it('creates a todo with a future due date', async () => {
    const due = futureDate()
    const req = makeRequest({ title: 'Deadline task', due_date: due })
    const res = await createTodo(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.due_date).toBe(due)
  })

  it('creates a todo with explicit priority', async () => {
    const req = makeRequest({ title: 'Urgent task', priority: 'high' })
    const res = await createTodo(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.priority).toBe('high')
  })

  it('defaults priority to medium when omitted', async () => {
    const req = makeRequest({ title: 'Normal task' })
    const res = await createTodo(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.priority).toBe('medium')
  })

  it('returns 400 for empty title', async () => {
    const req = makeRequest({ title: '' })
    const res = await createTodo(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/i)
  })

  it('returns 400 for whitespace-only title', async () => {
    const req = makeRequest({ title: '   ' })
    const res = await createTodo(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for a past due date', async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    const req = makeRequest({ title: 'Late task', due_date: past })
    const res = await createTodo(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/future/i)
  })

  it('creates a todo with tag ids and returns attached tags', async () => {
    const workTagRes = await createTag(makeTagRequest({ name: 'Work', color: '#2563EB' }))
    const urgentTagRes = await createTag(makeTagRequest({ name: 'Urgent', color: '#EF4444' }))
    const workTag = await workTagRes.json()
    const urgentTag = await urgentTagRes.json()

    const req = makeRequest({
      title: 'Tagged task',
      tag_ids: [workTag.id, urgentTag.id],
    })
    const res = await createTodo(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.tags).toHaveLength(2)
  })

  it('returns 400 for unknown tag id', async () => {
    const req = makeRequest({ title: 'Bad tag', tag_ids: [99999] })
    const res = await createTodo(req)
    expect(res.status).toBe(400)
  })

  it('does not persist todo when tag id is invalid', async () => {
    const req = makeRequest({ title: 'Should not persist', tag_ids: [99999] })
    const res = await createTodo(req)
    expect(res.status).toBe(400)

    const listRes = await listTodos()
    const body = await listRes.json()
    expect(body.todos).toHaveLength(0)
  })
})

describe('GET /api/todos', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('returns empty todos array when no todos exist', async () => {
    const res = await listTodos()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todos).toEqual([])
  })

  it('returns all todos', async () => {
    // Create two todos via POST
    await createTodo(makeRequest({ title: 'Task A' }))
    await createTodo(makeRequest({ title: 'Task B' }))

    const res = await listTodos()
    const body = await res.json()
    expect(body.todos).toHaveLength(2)
  })
})

describe('GET /api/todos/[id]', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('returns a todo by id', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Find me' }))
    const { id } = await createRes.json()

    const res = await getTodo(
      new NextRequest(`http://localhost/api/todos/${id}`),
      makeParams(id),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Find me')
  })

  it('returns 404 for non-existent id', async () => {
    const res = await getTodo(
      new NextRequest('http://localhost/api/todos/99999'),
      makeParams(99999),
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-numeric id', async () => {
    const res = await getTodo(
      new NextRequest('http://localhost/api/todos/abc'),
      makeParams('abc'),
    )
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/todos/[id]', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('updates the title', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Old title' }))
    const { id } = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    })
    const res = await updateTodo(req, makeParams(id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todo.title).toBe('New title')
    expect(body.next_instance).toBeNull()
  })

  it('updates priority', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Task', priority: 'medium' }))
    const { id } = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'low' }),
    })
    const res = await updateTodo(req, makeParams(id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todo.priority).toBe('low')
  })

  it('marks a todo as completed', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Task' }))
    const { id } = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const res = await updateTodo(req, makeParams(id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todo.completed).toBe(true)
  })

  it('returns 404 for non-existent id', async () => {
    const req = new NextRequest('http://localhost/api/todos/99999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    })
    const res = await updateTodo(req, makeParams(99999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for empty title', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Task' }))
    const { id } = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    const res = await updateTodo(req, makeParams(id))
    expect(res.status).toBe(400)
  })

  it('updates todo tags', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Task' }))
    const { id } = await createRes.json()

    const tagRes = await createTag(makeTagRequest({ name: 'Home', color: '#22C55E' }))
    const tag = await tagRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_ids: [tag.id] }),
    })
    const res = await updateTodo(req, makeParams(id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todo.tags).toHaveLength(1)
    expect(body.todo.tags[0].name).toBe('Home')
  })

  it('creates next instance when completing a recurring todo', async () => {
    const due = futureDate()
    const createRes = await createTodo(
      makeRequest({
        title: 'Recurring task',
        due_date: due,
        is_recurring: true,
        recurrence_pattern: 'daily',
      }),
    )
    const created = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const res = await updateTodo(req, makeParams(created.id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todo.completed).toBe(true)
    expect(body.next_instance).not.toBeNull()
    expect(body.next_instance.title).toBe('Recurring task')
    expect(body.next_instance.completed).toBe(false)
    expect(body.next_instance.is_recurring).toBe(true)
    expect(body.next_instance.recurrence_pattern).toBe('daily')
  })

  it('is idempotent for repeated completion updates on recurring todo', async () => {
    const due = futureDate()
    const createRes = await createTodo(
      makeRequest({
        title: 'Idempotent recurring',
        due_date: due,
        is_recurring: true,
        recurrence_pattern: 'weekly',
      }),
    )
    const created = await createRes.json()

    const req1 = new NextRequest(`http://localhost/api/todos/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const first = await updateTodo(req1, makeParams(created.id))
    expect(first.status).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.next_instance).not.toBeNull()

    const req2 = new NextRequest(`http://localhost/api/todos/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const second = await updateTodo(req2, makeParams(created.id))
    expect(second.status).toBe(200)
    const secondBody = await second.json()
    expect(secondBody.next_instance).toBeNull()
  })
})

describe('DELETE /api/todos/[id]', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('deletes a todo and returns 204', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Delete me' }))
    const { id } = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'DELETE',
    })
    const res = await deleteTodo(req, makeParams(id))

    expect(res.status).toBe(204)

    // Verify it's gone
    const getRes = await getTodo(
      new NextRequest(`http://localhost/api/todos/${id}`),
      makeParams(id),
    )
    expect(getRes.status).toBe(404)
  })

  it('returns 404 for non-existent id', async () => {
    const req = new NextRequest('http://localhost/api/todos/99999', {
      method: 'DELETE',
    })
    const res = await deleteTodo(req, makeParams(99999))
    expect(res.status).toBe(404)
  })
})
