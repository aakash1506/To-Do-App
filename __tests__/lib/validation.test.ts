import {
  createTagSchema,
  createTodoSchema,
  updateTagSchema,
  updateTodoSchema,
} from '@/lib/validation'

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

  describe('tag_ids validation', () => {
    it('accepts valid positive integer tag ids', () => {
      const result = createTodoSchema.safeParse({ title: 'Task', tag_ids: [1, 2] })
      expect(result.success).toBe(true)
    })

    it('rejects zero and negative tag ids', () => {
      const result = createTodoSchema.safeParse({ title: 'Task', tag_ids: [0, -1] })
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

  it('accepts updating tag_ids', () => {
    const result = updateTodoSchema.safeParse({ tag_ids: [1, 2, 3] })
    expect(result.success).toBe(true)
  })

  it('rejects invalid tag_ids on update', () => {
    const result = updateTodoSchema.safeParse({ tag_ids: [1, -2] })
    expect(result.success).toBe(false)
  })
})

describe('createTagSchema', () => {
  it('accepts valid tag payload', () => {
    const result = createTagSchema.safeParse({ name: 'Urgent', color: '#EF4444' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createTagSchema.safeParse({ name: '   ', color: '#EF4444' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid color', () => {
    const result = createTagSchema.safeParse({ name: 'Urgent', color: 'red' })
    expect(result.success).toBe(false)
  })
})

describe('updateTagSchema', () => {
  it('accepts partial update', () => {
    const result = updateTagSchema.safeParse({ color: '#22C55E' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid color', () => {
    const result = updateTagSchema.safeParse({ color: '#XYZ123' })
    expect(result.success).toBe(false)
  })
})
