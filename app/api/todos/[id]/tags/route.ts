import { NextRequest, NextResponse } from 'next/server'
import { tagDB, todoDB } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  if (!todoDB.findById(todoId, 1)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  return NextResponse.json({ tags: tagDB.findByTodo(todoId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  if (!todoDB.findById(todoId, 1)) return NextResponse.json({ error: 'Todo not found' }, { status: 404 })

  const body = await request.json()
  const tagId = typeof body.tag_id === 'number' ? body.tag_id : parseInt(body.tag_id, 10)
  if (isNaN(tagId)) return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })

  tagDB.addToTodo(todoId, tagId)
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const tagId = typeof body.tag_id === 'number' ? body.tag_id : parseInt(body.tag_id, 10)
  if (isNaN(tagId)) return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })

  tagDB.removeFromTodo(todoId, tagId)
  return new NextResponse(null, { status: 204 })
}
