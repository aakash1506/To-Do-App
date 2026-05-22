/**
 * Reminder constants and pure utilities for Feature 04.
 * No side-effects — safe to import in both server and client contexts.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const REMINDER_OPTIONS = [
  { value: 15,    label: '15 minutes before', badge: '15m' },
  { value: 30,    label: '30 minutes before', badge: '30m' },
  { value: 60,    label: '1 hour before',     badge: '1h'  },
  { value: 120,   label: '2 hours before',    badge: '2h'  },
  { value: 1440,  label: '1 day before',      badge: '1d'  },
  { value: 2880,  label: '2 days before',     badge: '2d'  },
  { value: 10080, label: '1 week before',     badge: '1w'  },
] as const

export type ReminderMinutes = (typeof REMINDER_OPTIONS)[number]['value']

export const VALID_REMINDER_MINUTES = REMINDER_OPTIONS.map((o) => o.value) as unknown as [
  ReminderMinutes,
  ...ReminderMinutes[],
]

// ─── Pure utilities ────────────────────────────────────────────────────────────

/**
 * Returns the 🔔 badge string for a given reminder_minutes value.
 * Returns null for unrecognised values.
 */
export function formatReminderBadge(minutes: number): string | null {
  const opt = REMINDER_OPTIONS.find((o) => o.value === minutes)
  return opt ? `🔔 ${opt.badge}` : null
}

/**
 * Returns the human-readable label for a given reminder_minutes value.
 */
export function formatReminderLabel(minutes: number): string {
  const opt = REMINDER_OPTIONS.find((o) => o.value === minutes)
  return opt ? opt.label : `${minutes} minutes before`
}

/**
 * Given a due date ISO string and reminder_minutes, returns the Date at which
 * the notification should fire (due_date minus reminder_minutes).
 */
export function getReminderFireTime(dueDateISO: string, reminderMinutes: number): Date {
  const due = new Date(dueDateISO)
  return new Date(due.getTime() - reminderMinutes * 60 * 1000)
}

/**
 * Returns true when the reminder should fire right now:
 *   fireTime <= now  AND  last_notification_sent is null
 */
export function shouldNotify(
  dueDateISO: string,
  reminderMinutes: number,
  lastNotificationSent: string | null,
): boolean {
  if (lastNotificationSent !== null) return false
  const fireTime = getReminderFireTime(dueDateISO, reminderMinutes)
  return fireTime.getTime() <= Date.now()
}
