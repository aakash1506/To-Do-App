/**
 * Integration tests for Template API routes.
 */

import path from 'path'
import os from 'os'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-api-test-'))
process.env.DB_PATH = path.join(tmpDir, 'template-test.db')

import { GET as listTemplates, POST as createTemplate } from '@/app/api/templates/route'
import { DELETE as deleteTemplate } from '@/app/api/templates/[id]/route'
import { POST as useTemplate } from '@/app/api/templates/[id]/use/route'
import { closeDb, getDb, subtaskDB } from '@/lib/db'

function makeReq(body: unknown, method = 'POST', url = 'http://localhost'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/templates', () => {
  beforeEach(() => getDb().exec('DELETE FROM templates'))

  it('returns empty array when no templates', async () => {
    const res = await listTemplates()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templates).toEqual([])
  })

  it('returns all templates', async () => {
    await createTemplate(makeReq({ name: 'Standup', title: 'Daily standup' }))
    await createTemplate(makeReq({ name: 'Review', title: 'Weekly review' }))
    const res = await listTemplates()
    const body = await res.json()
    expect(body.templates).toHaveLength(2)
  })
})

describe('POST /api/templates', () => {
  beforeEach(() => getDb().exec('DELETE FROM templates'))

  it('creates a template with name and title and returns 201', async () => {
    const req = makeReq({ name: 'Standup', title: 'Daily standup' })
    const res = await createTemplate(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Standup')
    expect(body.title).toBe('Daily standup')
    expect(body.priority).toBe('medium')
    expect(body.id).toBeGreaterThan(0)
  })

  it('creates a template with priority and recurrence', async () => {
    const req = makeReq({ name: 'T', title: 'Task', priority: 'high', recurrence_pattern: 'weekly' })
    const res = await createTemplate(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.priority).toBe('high')
    expect(body.recurrence_pattern).toBe('weekly')
  })

  it('creates a template with subtasks', async () => {
    const req = makeReq({
      name: 'T', title: 'Task',
      subtasks: [{ title: 'Step 1', position: 0 }, { title: 'Step 2', position: 1 }],
    })
    const res = await createTemplate(req)
    const body = await res.json()
    expect(body.subtasks).toHaveLength(2)
    expect(body.subtasks[0].title).toBe('Step 1')
  })

  it('returns 400 for empty name', async () => {
    const req = makeReq({ name: '', title: 'Task' })
    const res = await createTemplate(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty title', async () => {
    const req = makeReq({ name: 'Template', title: '' })
    const res = await createTemplate(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid priority', async () => {
    const req = makeReq({ name: 'T', title: 'Task', priority: 'critical' })
    const res = await createTemplate(req)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/templates/:id', () => {
  it('deletes a template and returns 204', async () => {
    const created = await createTemplate(makeReq({ name: 'Temp', title: 'Task' }))
    const template = await created.json()
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteTemplate(req, makeParams(template.id))
    expect(res.status).toBe(204)
  })

  it('returns 404 for non-existent template', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteTemplate(req, makeParams(99999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await deleteTemplate(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/templates/:id/use', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM subtasks')
    getDb().exec('DELETE FROM todos')
    getDb().exec('DELETE FROM templates')
  })

  it('creates a todo from a template and returns 201', async () => {
    const tmplRes = await createTemplate(makeReq({ name: 'Standup', title: 'Daily standup', priority: 'high' }))
    const tmpl = await tmplRes.json()

    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await useTemplate(req, makeParams(tmpl.id))
    expect(res.status).toBe(201)
    const todo = await res.json()
    expect(todo.title).toBe('Daily standup')
    expect(todo.priority).toBe('high')
  })

  it('creates subtasks from template', async () => {
    const tmplRes = await createTemplate(makeReq({
      name: 'T', title: 'Task',
      subtasks: [{ title: 'Step 1', position: 0 }, { title: 'Step 2', position: 1 }],
    }))
    const tmpl = await tmplRes.json()

    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await useTemplate(req, makeParams(tmpl.id))
    const todo = await res.json()
    const subtasks = subtaskDB.findByTodo(todo.id)
    expect(subtasks).toHaveLength(2)
    expect(subtasks[0].title).toBe('Step 1')
  })

  it('sets due date from offset when due_date_offset_days is set', async () => {
    const tmplRes = await createTemplate(makeReq({ name: 'T', title: 'Task', due_date_offset_days: 3 }))
    const tmpl = await tmplRes.json()

    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await useTemplate(req, makeParams(tmpl.id))
    const todo = await res.json()
    expect(todo.due_date).not.toBeNull()
    // Should be about 3 days from now
    const due = new Date(todo.due_date)
    const now = new Date()
    const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBeGreaterThanOrEqual(2)
    expect(diffDays).toBeLessThanOrEqual(4)
  })

  it('returns 404 for non-existent template', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await useTemplate(req, makeParams(99999))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid template id', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await useTemplate(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(400)
  })
})
