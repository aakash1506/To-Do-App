import { NextRequest, NextResponse } from 'next/server'
import { tagDB } from '@/lib/db'
import { updateTagSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)

    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateTagSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Validation failed'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const tag = tagDB.update(numId, parsed.data, 1)
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    return NextResponse.json(tag)
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      return NextResponse.json(
        { error: 'A tag with this name already exists' },
        { status: 409 },
      )
    }

    console.error('PUT /api/tags/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update tag' },
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

    const deleted = tagDB.delete(numId, 1)
    if (!deleted) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('DELETE /api/tags/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 },
    )
  }
}
