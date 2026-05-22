/**
 * Integration tests for Tag API routes.
 */

import path from 'path'
import os from 'os'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-api-test-'))
process.env.DB_PATH = path.join(tmpDir, 'tag-test.db')

import { GET as listTags, POST as createTag } from '@/app/api/tags/route'
import { DELETE as deleteTag } from '@/app/api/tags/[id]/route'
import {
  GET as getTodoTags,
  POST as addTagToTodo,
  DELETE as removeTagFromTodo,
} from '@/app/api/todos/[id]/tags/route'
import { POST as createTodo } from '@/app/api/todos/route'
import { closeDb, getDb } from '@/lib/db'

function makeReq(body: unknown, method = 'POST', url = 'http://localhost'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeTagParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

function makeTodoParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

let todoId: number

beforeAll(async () => {
  const req = makeReq({ title: 'Tagged todo' })
  const res = await createTodo(req)
  const body = await res.json()
  todoId = body.id
})

afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/tags', () => {
  beforeEach(() => getDb().exec('DELETE FROM tags'))

  it('returns empty array when no tags', async () => {
    const res = await listTags()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tags).toEqual([])
  })

  it('returns all tags', async () => {
    await createTag(makeReq({ name: 'Work', color: '#ff0000' }))
    await createTag(makeReq({ name: 'Personal', color: '#00ff00' }))
    const res = await listTags()
    const body = await res.json()
    expect(body.tags).toHaveLength(2)
  })
})

describe('POST /api/tags', () => {
  beforeEach(() => getDb().exec('DELETE FROM tags'))

  it('creates a tag and returns 201', async () => {
    const req = makeReq({ name: 'Work', color: '#ff5733' })
    const res = await createTag(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Work')
    expect(body.color).toBe('#ff5733')
    expect(body.id).toBeGreaterThan(0)
  })

  it('returns 400 for empty name', async () => {
    const req = makeReq({ name: '', color: '#000000' })
    const res = await createTag(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid color format', async () => {
    const req = makeReq({ name: 'Tag', color: 'red' })
    const res = await createTag(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate tag name', async () => {
    await createTag(makeReq({ name: 'Work', color: '#ff0000' }))
    const res = await createTag(makeReq({ name: 'Work', color: '#00ff00' }))
    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/tags/:id', () => {
  it('deletes a tag and returns 204', async () => {
    const created = await createTag(makeReq({ name: 'Temp', color: '#aabbcc' }))
    const tag = await created.json()
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteTag(req, makeTagParams(tag.id))
    expect(res.status).toBe(204)
  })

  it('returns 404 for non-existent tag', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteTag(req, makeTagParams(99999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteTag(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/todos/:id/tags', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM todo_tags')
    getDb().exec('DELETE FROM tags')
  })

  it('returns empty array when todo has no tags', async () => {
    const req = new NextRequest('http://localhost', { method: 'GET' })
    const res = await getTodoTags(req, makeTodoParams(todoId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tags).toEqual([])
  })

  it('returns 404 for non-existent todo', async () => {
    const req = new NextRequest('http://localhost', { method: 'GET' })
    const res = await getTodoTags(req, makeTodoParams(99999))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/todos/:id/tags (add tag)', () => {
  let tagId: number

  beforeEach(async () => {
    getDb().exec('DELETE FROM todo_tags')
    getDb().exec('DELETE FROM tags')
    const res = await createTag(makeReq({ name: 'Work', color: '#ff0000' }))
    const body = await res.json()
    tagId = body.id
  })

  it('adds a tag to a todo and returns 201', async () => {
    const req = makeReq({ tag_id: tagId })
    const res = await addTagToTodo(req, makeTodoParams(todoId))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 400 for missing tag_id', async () => {
    const req = makeReq({})
    const res = await addTagToTodo(req, makeTodoParams(todoId))
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent todo', async () => {
    const req = makeReq({ tag_id: tagId })
    const res = await addTagToTodo(req, makeTodoParams(99999))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/todos/:id/tags (remove tag)', () => {
  let tagId: number

  beforeEach(async () => {
    getDb().exec('DELETE FROM todo_tags')
    getDb().exec('DELETE FROM tags')
    const res = await createTag(makeReq({ name: 'Work', color: '#ff0000' }))
    const body = await res.json()
    tagId = body.id
    await addTagToTodo(makeReq({ tag_id: tagId }), makeTodoParams(todoId))
  })

  it('removes a tag from a todo and returns 204', async () => {
    const req = makeReq({ tag_id: tagId }, 'DELETE')
    const res = await removeTagFromTodo(req, makeTodoParams(todoId))
    expect(res.status).toBe(204)
  })

  it('returns 400 for missing tag_id', async () => {
    const req = makeReq({}, 'DELETE')
    const res = await removeTagFromTodo(req, makeTodoParams(todoId))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid todo id', async () => {
    const req = makeReq({ tag_id: tagId }, 'DELETE')
    const res = await removeTagFromTodo(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })
})
