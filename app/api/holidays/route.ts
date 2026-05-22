import { NextRequest, NextResponse } from 'next/server'
import { holidayDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (year && month) {
    const holidays = holidayDB.findByMonth(parseInt(year, 10), parseInt(month, 10))
    return NextResponse.json({ holidays })
  }
  return NextResponse.json({ holidays: holidayDB.findAll() })
}
