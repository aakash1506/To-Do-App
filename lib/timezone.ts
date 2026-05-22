/**
 * Singapore timezone utilities.
 * All date/time operations in this app MUST use these functions.
 * Never use `new Date()` directly — use `getSingaporeNow()` instead.
 */

const SINGAPORE_TZ = 'Asia/Singapore'

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
