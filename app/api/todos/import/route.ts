import { NextRequest, NextResponse } from 'next/server'
import { todoDB, subtaskDB, tagDB } from '@/lib/db'
import { z } from 'zod'

const importSchema = z.object({
  todos: z.array(z.object({
    title: z.string().min(1),
    completed: z.boolean().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    due_date: z.string().nullable().optional(),
    recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional(),
    reminder_minutes: z.number().nullable().optional(),
    subtasks: z.array(z.object({
      title: z.string().min(1),
      completed: z.boolean().optional(),
      position: z.number().int().optional(),
    })).optional(),
    tags: z.array(z.object({
      name: z.string().min(1),
      color: z.string(),
    })).optional(),
  })),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid import format' }, { status: 400 })
  }

  const imported: number[] = []
  for (const item of parsed.data.todos) {
    const todo = todoDB.create({
      title: item.title,
      priority: item.priority ?? 'medium',
      due_date: item.due_date ?? null,
      recurrence_pattern: item.recurrence_pattern ?? null,
      reminder_minutes: item.reminder_minutes ?? null,
      user_id: 1,
    })

    if (item.completed) {
      todoDB.update(todo.id, { completed: true }, 1)
    }

    // Create subtasks
    for (const s of item.subtasks ?? []) {
      const st = subtaskDB.create(todo.id, s.title, s.position ?? 0)
      if (s.completed) subtaskDB.update(st.id, todo.id, { completed: true })
    }

    // Create / reuse tags
    for (const t of item.tags ?? []) {
      const existing = tagDB.findAll(1).find((tag) => tag.name === t.name)
      const tag = existing ?? tagDB.create(1, t.name, t.color || '#6366f1')
      tagDB.addToTodo(todo.id, tag.id)
    }

    imported.push(todo.id)
  }

  return NextResponse.json({ imported: imported.length, ids: imported }, { status: 201 })
}
