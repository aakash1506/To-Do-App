import { NextRequest, NextResponse } from 'next/server'
import { todoDB } from '@/lib/db'
import { createTodoSchema } from '@/lib/validation'

export async function GET() {
  try {
    const todos = todoDB.findAll(1) // user_id=1 until auth is added
    return NextResponse.json({ todos })
  } catch (error) {
    console.error('GET /api/todos error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch todos' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createTodoSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Validation failed'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const todo = todoDB.create({
      title: parsed.data.title,
      due_date: parsed.data.due_date ?? null,
      user_id: 1,
    })

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    console.error('POST /api/todos error:', error)
    return NextResponse.json(
      { error: 'Failed to create todo' },
      { status: 500 },
    )
  }
}
