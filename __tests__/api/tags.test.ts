import path from 'path'
import os from 'os'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-tag-api-test-'))
process.env.DB_PATH = path.join(tmpDir, 'api-test.db')

import { GET as listTags, POST as createTag } from '@/app/api/tags/route'
import { PUT as updateTag, DELETE as deleteTag } from '@/app/api/tags/[id]/route'
import { closeDb, getDb } from '@/lib/db'

function makeRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/tags', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string | number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/tags', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('returns empty array when no tags exist', async () => {
    const res = await listTags()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tags).toEqual([])
  })
})

describe('POST /api/tags', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('creates a tag and returns 201', async () => {
    const res = await createTag(makeRequest({ name: 'Work', color: '#2563EB' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Work')
    expect(body.color).toBe('#2563EB')
  })

  it('rejects invalid color', async () => {
    const res = await createTag(makeRequest({ name: 'Work', color: 'blue' }))
    expect(res.status).toBe(400)
  })

  it('rejects duplicate tag names', async () => {
    await createTag(makeRequest({ name: 'Work', color: '#2563EB' }))
    const res = await createTag(makeRequest({ name: 'work', color: '#22C55E' }))
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/tags/[id]', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('updates tag name and color', async () => {
    const created = await createTag(makeRequest({ name: 'Work', color: '#2563EB' }))
    const tag = await created.json()

    const req = new NextRequest(`http://localhost/api/tags/${tag.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Office', color: '#0EA5E9' }),
    })

    const res = await updateTag(req, makeParams(tag.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Office')
    expect(body.color).toBe('#0EA5E9')
  })
})

describe('DELETE /api/tags/[id]', () => {
  beforeEach(() => {
    const db = getDb()
    db.exec('DELETE FROM todo_tags')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM todos')
  })

  it('deletes existing tag', async () => {
    const created = await createTag(makeRequest({ name: 'Work', color: '#2563EB' }))
    const tag = await created.json()

    const req = new NextRequest(`http://localhost/api/tags/${tag.id}`, {
      method: 'DELETE',
    })

    const res = await deleteTag(req, makeParams(tag.id))
    expect(res.status).toBe(204)
  })
})
