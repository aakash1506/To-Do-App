import { z } from 'zod'
import { VALID_REMINDER_MINUTES } from '@/lib/reminders'

const recurrencePatternSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly'])

/**
 * Validates that a datetime string is at least 1 minute in the future.
 * This is applied after parsing so we have a valid Date to compare.
 */
function isAtLeastOneMinuteInFuture(dateStr: string): boolean {
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return false
  return target.getTime() >= Date.now() + 60_000
}

function validateRecurringFields(
  data: {
    due_date?: string | null
    is_recurring?: boolean
    recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  },
  ctx: z.RefinementCtx,
) {
  if (data.is_recurring === true) {
    if (!data.due_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recurring todos require a due date',
        path: ['due_date'],
      })
    }
    if (!data.recurrence_pattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'recurrence_pattern is required when is_recurring is true',
        path: ['recurrence_pattern'],
      })
    }
  }

  if (data.is_recurring === false && data.recurrence_pattern !== undefined && data.recurrence_pattern !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'recurrence_pattern must be null when is_recurring is false',
      path: ['recurrence_pattern'],
    })
  }
}

export const createTodoSchema = z
  .object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(1, 'Title is required')
      .max(500, 'Title is too long (max 500 characters)')
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, 'Title is required'),

    priority: z.enum(['high', 'medium', 'low']).default('medium'),

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
      .union([
        z.literal(null),
        z
          .number()
          .int()
          .refine(
            (v) => VALID_REMINDER_MINUTES.includes(v as (typeof VALID_REMINDER_MINUTES)[number]),
            'Invalid reminder value',
          ),
      ])
      .optional(),

    is_recurring: z.boolean().optional().default(false),

    recurrence_pattern: recurrencePatternSchema.nullable().optional(),

    tag_ids: z
      .array(z.number().int().positive('Tag id must be a positive integer'))
      .optional(),
  })
  .superRefine((data, ctx) => {
    validateRecurringFields(data, ctx)

    if (data.reminder_minutes !== undefined && data.reminder_minutes !== null && !data.due_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reminder requires a due date',
        path: ['due_date'],
      })
    }
  })

export const updateTodoSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(500, 'Title is too long (max 500 characters)')
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, 'Title is required')
      .optional(),

    priority: z.enum(['high', 'medium', 'low']).optional(),

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
      .union([
        z.literal(null),
        z
          .number()
          .int()
          .refine(
            (v) => VALID_REMINDER_MINUTES.includes(v as (typeof VALID_REMINDER_MINUTES)[number]),
            'Invalid reminder value',
          ),
      ])
      .optional(),

    is_recurring: z.boolean().optional(),

    recurrence_pattern: recurrencePatternSchema.nullable().optional(),

    tag_ids: z
      .array(z.number().int().positive('Tag id must be a positive integer'))
      .optional(),
  })
  .superRefine((data, ctx) => {
    validateRecurringFields(data, ctx)
  })

export const createTagSchema = z.object({
  name: z
    .string({ required_error: 'Tag name is required' })
    .min(1, 'Tag name is required')
    .max(50, 'Tag name is too long (max 50 characters)')
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'Tag name is required'),

  color: z
    .string({ required_error: 'Tag color is required' })
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Tag color must be a valid hex color like #2563EB'),
})

export const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name is too long (max 50 characters)')
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'Tag name is required')
    .optional(),

  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Tag color must be a valid hex color like #2563EB')
    .optional(),
})

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
