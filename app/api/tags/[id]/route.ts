import { NextRequest, NextResponse } from 'next/server'
import { tagDB } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const tagId = parseInt(id, 10)
  if (isNaN(tagId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const deleted = tagDB.delete(tagId, 1)
  if (!deleted) return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
