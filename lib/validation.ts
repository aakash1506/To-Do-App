import { z } from 'zod'
import { VALID_REMINDER_MINUTES } from '@/lib/reminders'

/**
 * Validates that a datetime string is at least 1 minute in the future.
 * This is applied after parsing so we have a valid Date to compare.
 */
function isAtLeastOneMinuteInFuture(dateStr: string): boolean {
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return false
  return target.getTime() >= Date.now() + 60_000
}

export const createTodoSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title is required')
    .max(500, 'Title is too long (max 500 characters)')
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'Title is required'),

  due_date: z
    .string()
    .datetime({ offset: true, message: 'Due date must be a valid ISO 8601 datetime' })
    .refine(
      isAtLeastOneMinuteInFuture,
      'Due date must be at least 1 minute in the future',
    )
    .nullable()
    .optional(),

  reminder_minutes: z
    .union(VALID_REMINDER_MINUTES.map((v) => z.literal(v)) as [z.ZodLiteral<number>, ...z.ZodLiteral<number>[]])
    .nullable()
    .optional(),
})

export const updateTodoSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title is too long (max 500 characters)')
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'Title is required')
    .optional(),

  completed: z.boolean().optional(),

  due_date: z
    .string()
    .datetime({ offset: true, message: 'Due date must be a valid ISO 8601 datetime' })
    .refine(
      isAtLeastOneMinuteInFuture,
      'Due date must be at least 1 minute in the future',
    )
    .nullable()
    .optional(),

  reminder_minutes: z
    .union(VALID_REMINDER_MINUTES.map((v) => z.literal(v)) as [z.ZodLiteral<number>, ...z.ZodLiteral<number>[]])
    .nullable()
    .optional(),
})

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
