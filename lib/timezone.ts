/**
 * Singapore timezone utilities.
 * All date/time operations in this app MUST use these functions.
 * Never use `new Date()` directly — use `getSingaporeNow()` instead.
 */

const SINGAPORE_TZ = 'Asia/Singapore'

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface SingaporeDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/**
 * Returns the current moment as a Date object.
 * The underlying UTC value is correct; use toSingaporeISO() to format.
 */
export function getSingaporeNow(): Date {
  return new Date()
}

/**
 * Formats a Date as an ISO-8601 string with the +08:00 Singapore offset.
 * Example: "2025-11-15T14:30:00+08:00"
 */
export function toSingaporeISO(date: Date): string {
  // Intl.DateTimeFormat gives us the wall-clock components in SGT
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'

  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour') === '24' ? '00' : get('hour')
  const minute = get('minute')
  const second = get('second')

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`
}

/**
 * Returns true when the given ISO-8601 date string is at least 1 minute
 * in the future relative to the current Singapore wall-clock time.
 */
export function isFutureDate(dateStr: string): boolean {
  const target = new Date(dateStr)
  const now = getSingaporeNow()
  const oneMinuteMs = 60 * 1000
  return target.getTime() >= now.getTime() + oneMinuteMs
}

/**
 * Returns true when the given ISO-8601 date string is in the past
 * (strictly before now).
 */
export function isPastDate(dateStr: string): boolean {
  const target = new Date(dateStr)
  const now = getSingaporeNow()
  return target.getTime() < now.getTime()
}

/**
 * Parses a date string and returns a Date.
 * Throws if the string is not a valid ISO date.
 */
export function parseSingaporeDate(dateStr: string): Date {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateStr}`)
  }
  return date
}

function getSingaporeParts(date: Date): SingaporeDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  }
}

function daysInMonth(year: number, month: number): number {
  // Month is 1-based. JS Date normalizes overflowed dates.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function normalizeDateParts(
  year: number,
  month: number,
  day: number,
): Pick<SingaporeDateParts, 'year' | 'month' | 'day'> {
  const normalized = new Date(Date.UTC(year, month - 1, day))
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
  }
}

function toSingaporeOffsetISO(parts: SingaporeDateParts): string {
  const pad2 = (value: number) => String(value).padStart(2, '0')
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}+08:00`
}

export function calculateNextDueDate(
  currentDueISO: string,
  pattern: RecurrencePattern,
): string {
  const sourceDate = parseSingaporeDate(currentDueISO)
  const sourceParts = getSingaporeParts(sourceDate)

  let nextYear = sourceParts.year
  let nextMonth = sourceParts.month
  let nextDay = sourceParts.day

  switch (pattern) {
    case 'daily': {
      const normalized = normalizeDateParts(nextYear, nextMonth, nextDay + 1)
      nextYear = normalized.year
      nextMonth = normalized.month
      nextDay = normalized.day
      break
    }
    case 'weekly': {
      const normalized = normalizeDateParts(nextYear, nextMonth, nextDay + 7)
      nextYear = normalized.year
      nextMonth = normalized.month
      nextDay = normalized.day
      break
    }
    case 'monthly': {
      nextMonth += 1
      if (nextMonth > 12) {
        nextMonth = 1
        nextYear += 1
      }
      nextDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth))
      break
    }
    case 'yearly': {
      nextYear += 1
      nextDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth))
      break
    }
    default:
      throw new Error(`Invalid recurrence pattern: ${String(pattern)}`)
  }

  return toSingaporeOffsetISO({
    year: nextYear,
    month: nextMonth,
    day: nextDay,
    hour: sourceParts.hour,
    minute: sourceParts.minute,
    second: sourceParts.second,
  })
}
