import {
  getSingaporeNow,
  toSingaporeISO,
  isFutureDate,
  isPastDate,
  parseSingaporeDate,
} from '@/lib/timezone'

describe('getSingaporeNow', () => {
  it('returns a valid Date object', () => {
    const now = getSingaporeNow()
    expect(now).toBeInstanceOf(Date)
    expect(isNaN(now.getTime())).toBe(false)
  })

  it('is within 1 second of Date.now()', () => {
    const before = Date.now()
    const now = getSingaporeNow()
    const after = Date.now()
    expect(now.getTime()).toBeGreaterThanOrEqual(before)
    expect(now.getTime()).toBeLessThanOrEqual(after)
  })
})

describe('toSingaporeISO', () => {
  it('includes the +08:00 offset', () => {
    const date = new Date('2025-11-15T06:30:00.000Z') // 14:30 SGT
    const result = toSingaporeISO(date)
    expect(result).toMatch(/\+08:00$/)
  })

  it('formats the wall-clock time in Singapore timezone', () => {
    // 2025-11-15 06:30 UTC = 2025-11-15 14:30 SGT
    const date = new Date('2025-11-15T06:30:00.000Z')
    const result = toSingaporeISO(date)
    expect(result).toBe('2025-11-15T14:30:00+08:00')
  })

  it('handles midnight in Singapore correctly', () => {
    // 2025-11-14 16:00 UTC = 2025-11-15 00:00 SGT
    const date = new Date('2025-11-14T16:00:00.000Z')
    const result = toSingaporeISO(date)
    expect(result).toBe('2025-11-15T00:00:00+08:00')
  })
})

describe('isFutureDate', () => {
  it('returns true for a date 2 minutes in the future', () => {
    const future = new Date(Date.now() + 2 * 60 * 1000).toISOString()
    expect(isFutureDate(future)).toBe(true)
  })

  it('returns true for a date exactly 1 minute in the future', () => {
    const future = new Date(Date.now() + 61 * 1000).toISOString()
    expect(isFutureDate(future)).toBe(true)
  })

  it('returns false for the current time', () => {
    const now = new Date().toISOString()
    expect(isFutureDate(now)).toBe(false)
  })

  it('returns false for a date in the past', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    expect(isFutureDate(past)).toBe(false)
  })

  it('returns false for a date less than 1 minute in the future', () => {
    const soon = new Date(Date.now() + 30 * 1000).toISOString()
    expect(isFutureDate(soon)).toBe(false)
  })
})

describe('isPastDate', () => {
  it('returns true for a date in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isPastDate(past)).toBe(true)
  })

  it('returns false for a date in the future', () => {
    const future = new Date(Date.now() + 60 * 1000).toISOString()
    expect(isPastDate(future)).toBe(false)
  })
})

describe('parseSingaporeDate', () => {
  it('parses a valid ISO string', () => {
    const result = parseSingaporeDate('2025-11-15T14:30:00+08:00')
    expect(result).toBeInstanceOf(Date)
    expect(result.toISOString()).toBe('2025-11-15T06:30:00.000Z')
  })

  it('throws for an invalid date string', () => {
    expect(() => parseSingaporeDate('not-a-date')).toThrow('Invalid date string')
  })
})
