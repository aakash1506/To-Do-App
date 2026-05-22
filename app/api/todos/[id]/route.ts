import { NextRequest, NextResponse } from 'next/server'
import { todoDB } from '@/lib/db'
import { getRecurringValidationError, updateTodoSchema } from '@/lib/validation'

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

    const normalizedPatch = { ...parsed.data }
    if (
      normalizedPatch.is_recurring === false &&
      normalizedPatch.recurrence_pattern === undefined
    ) {
      normalizedPatch.recurrence_pattern = null
    }

    const existing = todoDB.findById(numId, 1)
    if (!existing) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    const mergedRecurringState = {
      is_recurring: parsed.data.is_recurring ?? existing.is_recurring,
      recurrence_pattern:
        normalizedPatch.recurrence_pattern !== undefined
          ? normalizedPatch.recurrence_pattern
          : existing.recurrence_pattern,
      due_date:
        normalizedPatch.due_date !== undefined
          ? normalizedPatch.due_date
          : existing.due_date,
    }

    const recurrenceError = getRecurringValidationError(mergedRecurringState)
    if (recurrenceError) {
      return NextResponse.json({ error: recurrenceError }, { status: 400 })
    }

    const result = todoDB.updateWithRecurring(numId, normalizedPatch, 1)
    if (!result) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Recurring todos require')
    ) {
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
