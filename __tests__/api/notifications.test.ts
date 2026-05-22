import path from 'path'
import os from 'os'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-notif-test-'))
process.env.DB_PATH = path.join(tmpDir, 'notif-test.db')

import { GET as checkNotifications } from '@/app/api/notifications/check/route'
import { POST as createTodo } from '@/app/api/todos/route'
import { closeDb, getDb } from '@/lib/db'

afterAll(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function makeTodoRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/notifications/check', () => {
  beforeEach(() => getDb().exec('DELETE FROM todos'))

  it('returns empty when no todos have reminders', async () => {
    const res = await checkNotifications()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todos).toEqual([])
  })

  it('returns empty when todo has reminder but fire time is in the future', async () => {
    // due in 2 hours, reminder 15 min before → fire time 1h45m from now
    const due = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await createTodo(makeTodoRequest({ title: 'Future task', due_date: due, reminder_minutes: 15 }))

    const res = await checkNotifications()
    const body = await res.json()
    expect(body.todos).toHaveLength(0)
  })

  it('returns todo when reminder fire time has passed', async () => {
    // due 10 minutes ago, reminder 15 min before → fire time 25 min ago
    const due = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    // We insert directly to bypass the "future date" validation
    getDb().prepare(
      `INSERT INTO todos (title, user_id, due_date, reminder_minutes) VALUES (?, 1, ?, ?)`
    ).run('Past due task', due, 15)

    const res = await checkNotifications()
    const body = await res.json()
    expect(body.todos).toHaveLength(1)
    expect(body.todos[0].title).toBe('Past due task')
  })

  it('marks last_notification_sent after returning', async () => {
    const due = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    getDb().prepare(
      `INSERT INTO todos (title, user_id, due_date, reminder_minutes) VALUES (?, 1, ?, ?)`
    ).run('Mark me', due, 15)

    // First check — should return the todo
    const first = await checkNotifications()
    expect((await first.json()).todos).toHaveLength(1)

    // Second check — already notified, should not return again
    const second = await checkNotifications()
    expect((await second.json()).todos).toHaveLength(0)
  })

  it('does not return completed todos', async () => {
    const due = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    getDb().prepare(
      `INSERT INTO todos (title, user_id, due_date, reminder_minutes, completed) VALUES (?, 1, ?, ?, 1)`
    ).run('Completed task', due, 15)

    const res = await checkNotifications()
    expect((await res.json()).todos).toHaveLength(0)
  })

  it('does not return todos without a reminder set', async () => {
    const due = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    getDb().prepare(
      `INSERT INTO todos (title, user_id, due_date) VALUES (?, 1, ?)`
    ).run('No reminder', due)

    const res = await checkNotifications()
    expect((await res.json()).todos).toHaveLength(0)
  })
})
