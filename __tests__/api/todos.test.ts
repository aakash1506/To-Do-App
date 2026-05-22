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
import { closeDb, getDb, todoDB } from '@/lib/db'

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

// Global teardown — runs after ALL test suites in this file
afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('POST /api/todos', () => {
  beforeEach(() => getDb().exec('DELETE FROM todos'))

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

  it('creates a recurring todo with a valid pattern', async () => {
    const req = makeRequest({
      title: 'Weekly review',
      due_date: futureDate(),
      is_recurring: true,
      recurrence_pattern: 'weekly',
    })
    const res = await createTodo(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.is_recurring).toBe(true)
    expect(body.recurrence_pattern).toBe('weekly')
  })

  it('returns 400 when recurring todo has no due date', async () => {
    const req = makeRequest({
      title: 'Daily habit',
      is_recurring: true,
      recurrence_pattern: 'daily',
    })
    const res = await createTodo(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Recurring todos require a due date')
  })

  it('returns 400 when recurring todo has no recurrence pattern', async () => {
    const req = makeRequest({
      title: 'Daily habit',
      due_date: futureDate(),
      is_recurring: true,
    })
    const res = await createTodo(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Recurrence pattern is required')
  })

  it('returns 400 when pattern is provided without repeat enabled', async () => {
    const req = makeRequest({
      title: 'One-off task',
      due_date: futureDate(),
      is_recurring: false,
      recurrence_pattern: 'daily',
    })
    const res = await createTodo(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Recurrence pattern requires Repeat enabled')
  })
})

describe('GET /api/todos', () => {
  beforeEach(() => getDb().exec('DELETE FROM todos'))

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
  beforeEach(() => getDb().exec('DELETE FROM todos'))

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
  beforeEach(() => getDb().exec('DELETE FROM todos'))

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
    expect(body.next_instance).toBeNull()
  })

  it('creates the next instance when recurring todo is completed', async () => {
    const todo = todoDB.create({
      title: 'Daily habit',
      due_date: '2026-05-22T09:00:00+08:00',
      is_recurring: true,
      recurrence_pattern: 'daily',
    })

    const req = new NextRequest(`http://localhost/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const res = await updateTodo(req, makeParams(todo.id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todo.completed).toBe(true)
    expect(body.next_instance).not.toBeNull()
    expect(body.next_instance.title).toBe('Daily habit')
    expect(body.next_instance.completed).toBe(false)
    expect(body.next_instance.due_date).toBe('2026-05-23T09:00:00+08:00')
    expect(body.next_instance.is_recurring).toBe(true)
    expect(body.next_instance.recurrence_pattern).toBe('daily')
  })

  it('does not create duplicate next instances when completed repeatedly', async () => {
    const todo = todoDB.create({
      title: 'Daily habit',
      due_date: '2026-05-22T09:00:00+08:00',
      is_recurring: true,
      recurrence_pattern: 'daily',
    })

    const firstReq = new NextRequest(`http://localhost/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const firstRes = await updateTodo(firstReq, makeParams(todo.id))

    const secondReq = new NextRequest(`http://localhost/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const secondRes = await updateTodo(secondReq, makeParams(todo.id))

    expect(firstRes.status).toBe(200)
    expect(secondRes.status).toBe(200)

    const firstBody = await firstRes.json()
    const secondBody = await secondRes.json()
    expect(firstBody.next_instance).not.toBeNull()
    expect(secondBody.next_instance).toBeNull()
    expect(todoDB.findAll()).toHaveLength(2)
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

  it('returns 400 when update enables recurrence without due_date', async () => {
    const createRes = await createTodo(makeRequest({ title: 'Task without due date' }))
    const { id } = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_recurring: true, recurrence_pattern: 'daily' }),
    })
    const res = await updateTodo(req, makeParams(id))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Recurring todos require a due date')
  })

  it('returns 400 when update provides pattern without recurrence enabled', async () => {
    const createRes = await createTodo(makeRequest({
      title: 'Task',
      due_date: futureDate(),
    }))
    const { id } = await createRes.json()

    const req = new NextRequest(`http://localhost/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurrence_pattern: 'weekly' }),
    })
    const res = await updateTodo(req, makeParams(id))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Recurrence pattern requires Repeat enabled')
  })
})

describe('DELETE /api/todos/[id]', () => {
  beforeEach(() => getDb().exec('DELETE FROM todos'))

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
