import { NextRequest, NextResponse } from 'next/server'
import { subtaskDB, todoDB } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  if (!todoDB.findById(todoId, 1)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  return NextResponse.json({ subtasks: subtaskDB.findByTodo(todoId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  if (!todoDB.findById(todoId, 1)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 })

  const body = await request.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const existing = subtaskDB.findByTodo(todoId)
  const position = typeof body.position === 'number' ? body.position : existing.length
  const subtask = subtaskDB.create(todoId, title, position)
  return NextResponse.json(subtask, { status: 201 })
}
