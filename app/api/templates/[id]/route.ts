import { NextRequest, NextResponse } from 'next/server'
import { templateDB } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const tId = parseInt(id, 10)
  if (isNaN(tId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const deleted = templateDB.delete(tId, 1)
  if (!deleted) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
