import { NextResponse } from 'next/server'
import { todoDB } from '@/lib/db'

export async function GET() {
  try {
    const todos = todoDB.findDueForNotification(1)
    return NextResponse.json({ todos })
  } catch (error) {
    console.error('GET /api/notifications/check error:', error)
    return NextResponse.json(
      { error: 'Failed to check notifications' },
      { status: 500 },
    )
  }
}
