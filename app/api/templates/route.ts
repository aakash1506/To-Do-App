import { NextRequest, NextResponse } from 'next/server'
import { templateDB } from '@/lib/db'
import { createTemplateSchema } from '@/lib/validation'

export async function GET() {
  return NextResponse.json({ templates: templateDB.findAll(1) })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 })
  }
  const template = templateDB.create(1, {
    name: parsed.data.name,
    title: parsed.data.title,
    priority: parsed.data.priority ?? 'medium',
    recurrence_pattern: parsed.data.recurrence_pattern ?? null,
    reminder_minutes: parsed.data.reminder_minutes ?? null,
    due_date_offset_days: parsed.data.due_date_offset_days ?? null,
    subtasks: parsed.data.subtasks ?? [],
  })
  return NextResponse.json(template, { status: 201 })
}
