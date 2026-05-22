import { NextRequest, NextResponse } from 'next/server'
import { templateDB, todoDB, subtaskDB } from '@/lib/db'
import { getSingaporeNow } from '@/lib/timezone'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const tId = parseInt(id, 10)
  if (isNaN(tId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const template = templateDB.findById(tId, 1)
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Calculate due date from offset
  let due_date: string | null = null
  if (template.due_date_offset_days !== null) {
    const now = getSingaporeNow()
    now.setDate(now.getDate() + template.due_date_offset_days)
    now.setHours(9, 0, 0, 0) // default 9am SGT
    due_date = now.toISOString()
  }

  const todo = todoDB.create({
    title: template.title,
    priority: template.priority,
    due_date,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
    user_id: 1,
  })

  // Create subtasks
  for (const s of template.subtasks) {
    subtaskDB.create(todo.id, s.title, s.position)
  }

  return NextResponse.json(todo, { status: 201 })
}
