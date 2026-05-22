import { createTodoSchema, updateTodoSchema } from '@/lib/validation'

const futureDate = () =>
  new Date(Date.now() + 2 * 60 * 1000).toISOString() // 2 min from now

describe('createTodoSchema', () => {
  describe('title validation', () => {
    it('accepts a valid title', () => {
      const result = createTodoSchema.safeParse({ title: 'Buy groceries' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.title).toBe('Buy groceries')
    })

    it('trims whitespace from title', () => {
      const result = createTodoSchema.safeParse({ title: '  Buy groceries  ' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.title).toBe('Buy groceries')
    })

    it('rejects an empty title', () => {
      const result = createTodoSchema.safeParse({ title: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/required/i)
      }
    })

    it('rejects a whitespace-only title', () => {
      const result = createTodoSchema.safeParse({ title: '   ' })
      expect(result.success).toBe(false)
    })

    it('rejects a title over 500 characters', () => {
      const result = createTodoSchema.safeParse({ title: 'a'.repeat(501) })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/long/i)
      }
    })

    it('accepts a title of exactly 500 characters', () => {
      const result = createTodoSchema.safeParse({ title: 'a'.repeat(500) })
      expect(result.success).toBe(true)
    })

    it('rejects missing title', () => {
      const result = createTodoSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('due_date validation', () => {
    it('accepts a valid future ISO date', () => {
      const result = createTodoSchema.safeParse({
        title: 'Task',
        due_date: futureDate(),
      })
      expect(result.success).toBe(true)
    })

    it('accepts null due_date (no deadline)', () => {
      const result = createTodoSchema.safeParse({ title: 'Task', due_date: null })
      expect(result.success).toBe(true)
    })

    it('accepts omitted due_date', () => {
      const result = createTodoSchema.safeParse({ title: 'Task' })
      expect(result.success).toBe(true)
    })

    it('rejects a past due date', () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString()
      const result = createTodoSchema.safeParse({ title: 'Task', due_date: past })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/future/i)
      }
    })

    it('rejects a due date less than 1 minute in the future', () => {
      const soon = new Date(Date.now() + 30 * 1000).toISOString()
      const result = createTodoSchema.safeParse({ title: 'Task', due_date: soon })
      expect(result.success).toBe(false)
    })

    it('rejects a non-ISO date string', () => {
      const result = createTodoSchema.safeParse({
        title: 'Task',
        due_date: 'tomorrow',
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('updateTodoSchema', () => {
  it('accepts an empty object (no-op update)', () => {
    const result = updateTodoSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial updates', () => {
    const result = updateTodoSchema.safeParse({ title: 'Updated title' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.title).toBe('Updated title')
  })

  it('accepts completed: true', () => {
    const result = updateTodoSchema.safeParse({ completed: true })
    expect(result.success).toBe(true)
  })

  it('rejects an empty title string', () => {
    const result = updateTodoSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only title', () => {
    const result = updateTodoSchema.safeParse({ title: '   ' })
    expect(result.success).toBe(false)
  })

  it('accepts clearing due_date with null', () => {
    const result = updateTodoSchema.safeParse({ due_date: null })
    expect(result.success).toBe(true)
  })

  it('rejects a past due_date', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    const result = updateTodoSchema.safeParse({ due_date: past })
    expect(result.success).toBe(false)
  })
})
