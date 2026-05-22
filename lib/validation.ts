import { z } from 'zod'

const recurrencePatterns = ['daily', 'weekly', 'monthly', 'yearly'] as const
const recurrencePatternSchema = z.enum(recurrencePatterns, {
  errorMap: () => ({ message: 'Invalid recurrence pattern' }),
})

type RecurrencePattern = (typeof recurrencePatterns)[number]

type RecurrenceValidationInput = {
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  due_date?: string | null
}

export function getRecurringValidationError(
  input: RecurrenceValidationInput,
): string | null {
  if (input.is_recurring) {
    if (!input.due_date) {
      return 'Recurring todos require a due date'
    }
    if (!input.recurrence_pattern) {
      return 'Recurrence pattern is required'
    }
    return null
  }

  if (input.recurrence_pattern) {
    return 'Recurrence pattern requires Repeat enabled'
  }

  return null
}

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

  is_recurring: z.boolean().optional(),

  recurrence_pattern: recurrencePatternSchema
    .nullable()
    .optional(),
}).superRefine((data, ctx) => {
  const error = getRecurringValidationError({
    is_recurring: data.is_recurring,
    recurrence_pattern: data.recurrence_pattern,
    due_date: data.due_date,
  })

  if (!error) return

  const path = error.includes('due date') ? ['due_date'] : ['recurrence_pattern']
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: error,
    path,
  })
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

  is_recurring: z.boolean().optional(),

  recurrence_pattern: recurrencePatternSchema
    .nullable()
    .optional(),
})

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
