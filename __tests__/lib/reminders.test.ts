import {
  formatReminderBadge,
  formatReminderLabel,
  getReminderFireTime,
  shouldNotify,
  REMINDER_OPTIONS,
  VALID_REMINDER_MINUTES,
} from '@/lib/reminders'

describe('REMINDER_OPTIONS', () => {
  it('has 7 options', () => {
    expect(REMINDER_OPTIONS).toHaveLength(7)
  })

  it('contains the required timing values', () => {
    const values = REMINDER_OPTIONS.map((o) => o.value)
    expect(values).toEqual([15, 30, 60, 120, 1440, 2880, 10080])
  })

  it('every option has value, label and badge', () => {
    for (const opt of REMINDER_OPTIONS) {
      expect(typeof opt.value).toBe('number')
      expect(typeof opt.label).toBe('string')
      expect(typeof opt.badge).toBe('string')
    }
  })
})

describe('VALID_REMINDER_MINUTES', () => {
  it('contains all 7 values', () => {
    expect(VALID_REMINDER_MINUTES).toHaveLength(7)
  })
})

describe('formatReminderBadge', () => {
  it.each([
    [15,    '🔔 15m'],
    [30,    '🔔 30m'],
    [60,    '🔔 1h'],
    [120,   '🔔 2h'],
    [1440,  '🔔 1d'],
    [2880,  '🔔 2d'],
    [10080, '🔔 1w'],
  ])('returns correct badge for %d minutes', (minutes, expected) => {
    expect(formatReminderBadge(minutes)).toBe(expected)
  })

  it('returns null for an unrecognised value', () => {
    expect(formatReminderBadge(999)).toBeNull()
  })
})

describe('formatReminderLabel', () => {
  it('returns the label for 60 minutes', () => {
    expect(formatReminderLabel(60)).toBe('1 hour before')
  })

  it('returns a fallback for unknown values', () => {
    expect(formatReminderLabel(999)).toBe('999 minutes before')
  })
})

describe('getReminderFireTime', () => {
  it('subtracts reminder minutes from the due date', () => {
    const due = '2025-11-15T14:00:00+08:00'  // 14:00 SGT
    const fire = getReminderFireTime(due, 60)  // 1 hour before → 13:00 SGT
    // 13:00 SGT = 05:00 UTC
    expect(fire.toISOString()).toBe('2025-11-15T05:00:00.000Z')
  })

  it('handles 15-minute reminder', () => {
    const due = new Date(Date.now() + 20 * 60 * 1000).toISOString()
    const fire = getReminderFireTime(due, 15)
    const expectedMs = new Date(due).getTime() - 15 * 60 * 1000
    expect(fire.getTime()).toBe(expectedMs)
  })
})

describe('shouldNotify', () => {
  it('returns true when fire time has passed and never notified', () => {
    const due = new Date(Date.now() - 1000).toISOString() // already overdue
    expect(shouldNotify(due, 15, null)).toBe(true)
  })

  it('returns false when fire time is in the future', () => {
    const due = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    expect(shouldNotify(due, 15, null)).toBe(false)
  })

  it('returns false when already notified (last_notification_sent is set)', () => {
    const due = new Date(Date.now() - 1000).toISOString()
    expect(shouldNotify(due, 15, new Date().toISOString())).toBe(false)
  })

  it('returns true when fire time is exactly now (≤ now)', () => {
    const fireTime = new Date(Date.now() - 1).toISOString()
    // due = fireTime + 15 minutes
    const due = new Date(new Date(fireTime).getTime() + 15 * 60 * 1000).toISOString()
    expect(shouldNotify(due, 15, null)).toBe(true)
  })
})
