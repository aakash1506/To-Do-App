import { NextRequest, NextResponse } from 'next/server'
import { tagDB } from '@/lib/db'
import { createTagSchema } from '@/lib/validation'

export async function GET() {
  return NextResponse.json({ tags: tagDB.findAll(1) })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 })
  }
  try {
    const tag = tagDB.create(1, parsed.data.name, parsed.data.color)
    return NextResponse.json(tag, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 })
  }
}
