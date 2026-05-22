import { NextRequest, NextResponse } from 'next/server'
import { tagDB } from '@/lib/db'
import { createTagSchema } from '@/lib/validation'

export async function GET() {
  try {
    const tags = tagDB.findAll(1)
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('GET /api/tags error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createTagSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Validation failed'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const tag = tagDB.create({
      name: parsed.data.name,
      color: parsed.data.color,
      user_id: 1,
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      return NextResponse.json(
        { error: 'A tag with this name already exists' },
        { status: 409 },
      )
    }

    console.error('POST /api/tags error:', error)
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 },
    )
  }
}
