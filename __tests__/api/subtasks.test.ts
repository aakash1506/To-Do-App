/**
 * Integration tests for Subtask API routes.
 */

import path from 'path'
import os from 'os'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subtask-api-test-'))
process.env.DB_PATH = path.join(tmpDir, 'subtask-test.db')

import { GET as listSubtasks, POST as createSubtask } from '@/app/api/todos/[id]/subtasks/route'
import {
  PUT as updateSubtask,
  DELETE as deleteSubtask,
} from '@/app/api/todos/[id]/subtasks/[subtaskId]/route'
import { POST as createTodo } from '@/app/api/todos/route'
import { closeDb, getDb } from '@/lib/db'

function makeTodoParams(todoId: number) {
  return { params: Promise.resolve({ id: String(todoId) }) }
}

function makeSubtaskParams(todoId: number, subtaskId: number) {
  return { params: Promise.resolve({ id: String(todoId), subtaskId: String(subtaskId) }) }
}

function makeReq(body: unknown, method = 'POST', url = 'http://localhost'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

let todoId: number

beforeAll(async () => {
  const req = makeReq({ title: 'Parent todo' })
  const res = await createTodo(req)
  const body = await res.json()
  todoId = body.id
})

afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/todos/:id/subtasks', () => {
  beforeEach(() => getDb().exec('DELETE FROM subtasks'))

  it('returns empty array when no subtasks', async () => {
    const req = new NextRequest('http://localhost', { method: 'GET' })
    const res = await listSubtasks(req, makeTodoParams(todoId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subtasks).toEqual([])
  })

  it('returns 404 for non-existent todo', async () => {
    const req = new NextRequest('http://localhost', { method: 'GET' })
    const res = await listSubtasks(req, makeTodoParams(99999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid todo id', async () => {
    const req = new NextRequest('http://localhost', { method: 'GET' })
    const res = await listSubtasks(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/todos/:id/subtasks', () => {
  beforeEach(() => getDb().exec('DELETE FROM subtasks'))

  it('creates a subtask and returns 201', async () => {
    const req = makeReq({ title: 'Step 1' })
    const res = await createSubtask(req, makeTodoParams(todoId))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Step 1')
    expect(body.completed).toBe(false)
    expect(body.todo_id).toBe(todoId)
  })

  it('returns 400 for empty title', async () => {
    const req = makeReq({ title: '' })
    const res = await createSubtask(req, makeTodoParams(todoId))
    expect(res.status).toBe(400)
  })

  it('returns 400 for whitespace-only title', async () => {
    const req = makeReq({ title: '   ' })
    const res = await createSubtask(req, makeTodoParams(todoId))
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent todo', async () => {
    const req = makeReq({ title: 'Step 1' })
    const res = await createSubtask(req, makeTodoParams(99999))
    expect(res.status).toBe(404)
  })

  it('assigns position from request body', async () => {
    const req = makeReq({ title: 'Step 2', position: 5 })
    const res = await createSubtask(req, makeTodoParams(todoId))
    const body = await res.json()
    expect(body.position).toBe(5)
  })
})

describe('PUT /api/todos/:id/subtasks/:subtaskId', () => {
  let subtaskId: number

  beforeEach(async () => {
    getDb().exec('DELETE FROM subtasks')
    const req = makeReq({ title: 'Original title' })
    const res = await createSubtask(req, makeTodoParams(todoId))
    const body = await res.json()
    subtaskId = body.id
  })

  it('updates the title', async () => {
    const req = makeReq({ title: 'Updated title' }, 'PUT')
    const res = await updateSubtask(req, makeSubtaskParams(todoId, subtaskId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Updated title')
  })

  it('marks subtask as completed', async () => {
    const req = makeReq({ completed: true }, 'PUT')
    const res = await updateSubtask(req, makeSubtaskParams(todoId, subtaskId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completed).toBe(true)
  })

  it('marks subtask as incomplete', async () => {
    const reqComplete = makeReq({ completed: true }, 'PUT')
    await updateSubtask(reqComplete, makeSubtaskParams(todoId, subtaskId))
    const req = makeReq({ completed: false }, 'PUT')
    const res = await updateSubtask(req, makeSubtaskParams(todoId, subtaskId))
    const body = await res.json()
    expect(body.completed).toBe(false)
  })

  it('returns 404 for non-existent subtask', async () => {
    const req = makeReq({ completed: true }, 'PUT')
    const res = await updateSubtask(req, makeSubtaskParams(todoId, 99999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid ids', async () => {
    const req = makeReq({ completed: true }, 'PUT')
    const res = await updateSubtask(req, { params: Promise.resolve({ id: 'abc', subtaskId: 'xyz' }) })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/todos/:id/subtasks/:subtaskId', () => {
  let subtaskId: number

  beforeEach(async () => {
    getDb().exec('DELETE FROM subtasks')
    const req = makeReq({ title: 'Delete me' })
    const res = await createSubtask(req, makeTodoParams(todoId))
    const body = await res.json()
    subtaskId = body.id
  })

  it('deletes the subtask and returns 204', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteSubtask(req, makeSubtaskParams(todoId, subtaskId))
    expect(res.status).toBe(204)
  })

  it('returns 404 when deleting non-existent subtask', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteSubtask(req, makeSubtaskParams(todoId, 99999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid ids', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteSubtask(req, { params: Promise.resolve({ id: 'abc', subtaskId: 'xyz' }) })
    expect(res.status).toBe(400)
  })
})
