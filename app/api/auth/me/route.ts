import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { userDB } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })
  const user = userDB.findById(session.userId)
  return NextResponse.json({ user })
}
