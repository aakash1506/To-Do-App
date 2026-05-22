import { NextRequest, NextResponse } from 'next/server'
import { subtaskDB, todoDB } from '@/lib/db'

type Params = { params: Promise<{ id: string; subtaskId: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const { id, subtaskId } = await params
  const todoId = parseInt(id, 10)
  const sId = parseInt(subtaskId, 10)
  if (isNaN(todoId) || isNaN(sId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  if (!todoDB.findById(todoId, 1)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 })

  const body = await request.json()
  const dto: { title?: string; completed?: boolean } = {}
  if (typeof body.title === 'string') dto.title = body.title.trim()
  if (typeof body.completed === 'boolean') dto.completed = body.completed

  const updated = subtaskDB.update(sId, todoId, dto)
  if (!updated) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, subtaskId } = await params
  const todoId = parseInt(id, 10)
  const sId = parseInt(subtaskId, 10)
  if (isNaN(todoId) || isNaN(sId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const deleted = subtaskDB.delete(sId, todoId)
  if (!deleted) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
