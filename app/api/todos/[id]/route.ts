import { NextRequest, NextResponse } from 'next/server'
import { todoDB } from '@/lib/db'
import { updateTodoSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)

    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const todo = todoDB.findById(numId, 1)
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    return NextResponse.json(todo)
  } catch (error) {
    console.error('GET /api/todos/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch todo' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)

    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateTodoSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Validation failed'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const updated = todoDB.update(numId, {
      ...parsed.data,
      reminder_minutes: parsed.data.reminder_minutes ?? undefined,
    }, 1)
    if (!updated) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && /One or more tags do not exist/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('PUT /api/todos/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update todo' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)

    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const deleted = todoDB.delete(numId, 1)
    if (!deleted) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('DELETE /api/todos/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete todo' },
      { status: 500 },
    )
  }
}
