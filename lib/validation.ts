import { z } from 'zod'

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

  tag_ids: z
    .array(z.number().int().positive('Tag id must be a positive integer'))
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

  tag_ids: z
    .array(z.number().int().positive('Tag id must be a positive integer'))
    .optional(),
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
