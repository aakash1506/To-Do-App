'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { REMINDER_OPTIONS, formatReminderBadge } from '@/lib/reminders'

// Types

type Priority = 'high' | 'medium' | 'low'
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface Tag {
  id: number
  name: string
  color: string
}

interface Todo {
  id: number
  title: string
  priority: Priority
  completed: boolean
  due_date: string | null
  reminder_minutes: number | null
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  created_at: string
  updated_at: string
  tags: Tag[]
}

function toPriority(value: string): Priority {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

function toRecurrencePattern(value: string): RecurrencePattern {
  if (value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly') return value
  return 'daily'
}

function formatRecurrenceLabel(pattern: RecurrencePattern): string {
  if (pattern === 'daily') return 'Repeats daily'
  if (pattern === 'weekly') return 'Repeats weekly'
  if (pattern === 'monthly') return 'Repeats monthly'
  return 'Repeats yearly'
}

// Helpers

function getMinFutureDate(): string {
  const now = new Date(Date.now() + 2 * 60 * 1000)
  return now.toISOString().slice(0, 16)
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function isOverdue(todo: Todo): boolean {
  if (!todo.due_date || todo.completed) return false
  return new Date(todo.due_date).getTime() < Date.now()
}

function getTagTextColor(backgroundHex: string): string {
  const cleaned = backgroundHex.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1F2937' : '#FFFFFF'
}

// API helpers

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (res.status === 204) return undefined as T
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data as T
}

// Sub-components

function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: tag.color,
        color: getTagTextColor(tag.color),
      }}
    >
      {tag.name}
    </span>
  )
}

interface TagSelectorProps {
  tags: Tag[]
  selectedTagIds: number[]
  onChange: (next: number[]) => void
}

function TagSelector({ tags, selectedTagIds, onChange }: TagSelectorProps) {
  function toggleTag(id: number) {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((tagId) => tagId !== id)
      : [...selectedTagIds, id]
    onChange(next)
  }

  if (tags.length === 0) {
    return <p className="text-xs text-gray-500">No tags yet</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const active = selectedTagIds.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              active ? 'border-transparent ring-2 ring-offset-1' : 'border-gray-300'
            }`}
            style={{
              backgroundColor: active ? tag.color : '#FFFFFF',
              color: active ? getTagTextColor(tag.color) : '#374151',
              boxShadow: active ? `0 0 0 2px ${tag.color}` : 'none',
            }}
          >
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}

interface EditModalProps {
  todo: Todo
  availableTags: Tag[]
  onClose: () => void
  onSave: (
    id: number,
    title: string,
    priority: Priority,
    due_date: string | null,
    tag_ids: number[],
  ) => Promise<void>
}

function EditModal({ todo, availableTags, onClose, onSave }: EditModalProps) {
  const [title, setTitle] = useState(todo.title)
  const [priority, setPriority] = useState<Priority>(todo.priority)
  const [dueDate, setDueDate] = useState(
    todo.due_date ? new Date(todo.due_date).toISOString().slice(0, 16) : '',
  )
  const [selectedTagIds, setSelectedTagIds] = useState(
    todo.tags.map((tag) => tag.id),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    try {
      const due = dueDate ? new Date(dueDate).toISOString() : null
      await onSave(todo.id, title.trim(), priority, due, selectedTagIds)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold mb-4">Edit Todo</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={500}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(toPriority(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date (optional)
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={getMinFutureDate()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <p className="block text-sm font-medium text-gray-700">Tags</p>
            <TagSelector
              tags={availableTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface TodoCardProps {
  todo: Todo
  onToggle: (id: number, completed: boolean) => Promise<void>
  onEdit: (todo: Todo) => void
  onDelete: (id: number) => Promise<void>
}

function TodoCard({ todo, onToggle, onEdit, onDelete }: TodoCardProps) {
  const [deleting, setDeleting] = useState(false)

  const priorityClasses = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-emerald-100 text-emerald-700',
  } as const

  async function handleDelete() {
    if (!window.confirm(`Delete "${todo.title}"?`)) return
    setDeleting(true)
    try {
      await onDelete(todo.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border bg-white shadow-sm ${
        todo.completed ? 'opacity-60' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id, todo.completed)}
        className="mt-1 h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
        aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
      />
      <div className="flex-1 min-w-0 space-y-2">
        <p
          className={`text-sm font-medium break-words ${
            todo.completed ? 'line-through text-gray-400' : 'text-gray-800'
          }`}
        >
          {todo.title}
        </p>
        <div className="mt-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityClasses[todo.priority]}`}
          >
            {todo.priority[0].toUpperCase() + todo.priority.slice(1)}
          </span>
        </div>
        {todo.is_recurring && todo.recurrence_pattern && (
          <div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
              {formatRecurrenceLabel(todo.recurrence_pattern)}
            </span>
          </div>
        )}
        {todo.due_date && (
          <div className="mt-1 flex flex-wrap gap-1">
            <DueDateBadge dateStr={todo.due_date} />
            {todo.reminder_minutes !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                {formatReminderBadge(todo.reminder_minutes)}
              </span>
            )}
          </div>
        )}
        {todo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {todo.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onEdit(todo)}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
          aria-label="Edit todo"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50"
          aria-label="Delete todo"
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

function DueDateBadge({ dateStr }: { dateStr: string }) {
  const overdue = new Date(dateStr).getTime() < Date.now()
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        overdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
      }`}
    >
      {overdue ? '⚠ ' : ''}
      {formatDueDate(dateStr)}
    </span>
  )
}

interface SectionProps {
  title: string
  count: number
  variant?: 'default' | 'overdue' | 'completed'
  children: React.ReactNode
  collapsible?: boolean
}

function Section({
  title,
  count,
  variant = 'default',
  children,
  collapsible = false,
}: SectionProps) {
  const [open, setOpen] = useState(true)

  const headerColors = {
    default: 'text-gray-700',
    overdue: 'text-red-700',
    completed: 'text-gray-500',
  }

  if (count === 0) return null

  return (
    <section className="space-y-2">
      <button
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${headerColors[variant]} ${
          collapsible ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
        }`}
      >
        {variant === 'overdue' && <span>⚠</span>}
        {title}
        <span className="bg-gray-200 text-gray-600 text-xs rounded-full px-2 py-0.5">
          {count}
        </span>
        {collapsible && (
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        )}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  )
}

// Main page

export default function HomePage() {
  const { permission, requestPermission } = useNotifications()

  const [todos, setTodos] = useState<Todo[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#2563EB')
  const [tagError, setTagError] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)

  const fetchTodos = useCallback(async () => {
    const data = await apiFetch<{ todos: Todo[] }>('/api/todos')
    setTodos(data.todos)
  }, [])

  const fetchTags = useCallback(async () => {
    const data = await apiFetch<{ tags: Tag[] }>('/api/tags')
    setTags(data.tags)
  }, [])

  useEffect(() => {
    async function bootstrap() {
      try {
        await Promise.all([fetchTodos(), fetchTags()])
      } catch {
        // Ignore load errors in MVP mode
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [fetchTags, fetchTodos])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setAddError('Title is required')
      return
    }
    if (isRecurring && !dueDate) {
      setAddError('Recurring todos require a due date')
      return
    }

    setAdding(true)
    setAddError('')
    try {
      const due = dueDate ? new Date(dueDate).toISOString() : null
      const todo = await apiFetch<Todo>('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          due_date: due,
          reminder_minutes: reminderMinutes,
          is_recurring: isRecurring,
          recurrence_pattern: isRecurring ? recurrencePattern : null,
          tag_ids: selectedTagIds,
        }),
      })
      setTodos((prev) => [...prev, todo])
      setTitle('')
      setPriority('medium')
      setDueDate('')
      setReminderMinutes(null)
      setIsRecurring(false)
      setRecurrencePattern('daily')
      setSelectedTagIds([])
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add todo')
    } finally {
      setAdding(false)
    }
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault()
    if (!newTagName.trim()) {
      setTagError('Tag name is required')
      return
    }

    setTagError('')
    setCreatingTag(true)
    try {
      const tag = await apiFetch<Tag>('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
        }),
      })
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTagName('')
      setNewTagColor('#2563EB')
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to create tag')
    } finally {
      setCreatingTag(false)
    }
  }

  async function handleDeleteTag(id: number, name: string) {
    if (!window.confirm(`Delete tag "${name}"?`)) return

    try {
      await apiFetch(`/api/tags/${id}`, { method: 'DELETE' })
      setTags((prev) => prev.filter((tag) => tag.id !== id))
      setSelectedTagIds((prev) => prev.filter((tagId) => tagId !== id))
      setSelectedTagFilter((prev) => (prev === id ? null : prev))
      setTodos((prev) =>
        prev.map((todo) => ({
          ...todo,
          tags: todo.tags.filter((tag) => tag.id !== id),
        })),
      )
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to delete tag')
    }
  }

  async function handleEditTag(tag: Tag) {
    const name = window.prompt('Update tag name', tag.name)
    if (name === null) return

    const color = window.prompt('Update tag color (hex like #22C55E)', tag.color)
    if (color === null) return

    try {
      const updated = await apiFetch<Tag>(`/api/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color: color.trim() }),
      })

      setTags((prev) =>
        prev
          .map((existing) => (existing.id === updated.id ? updated : existing))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      setTodos((prev) =>
        prev.map((todo) => ({
          ...todo,
          tags: todo.tags.map((existing) =>
            existing.id === updated.id ? updated : existing,
          ),
        })),
      )
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to update tag')
    }
  }

  async function handleToggle(id: number, currentCompleted: boolean) {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !currentCompleted } : todo,
      ),
    )
    try {
      const result = await apiFetch<{ todo: Todo; next_instance: Todo | null }>(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted }),
      })
      setTodos((prev) => {
        const replaced = prev.map((todo) => (todo.id === id ? result.todo : todo))
        return result.next_instance ? [...replaced, result.next_instance] : replaced
      })
    } catch {
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, completed: currentCompleted } : todo,
        ),
      )
    }
  }

  async function handleSaveEdit(
    id: number,
    newTitle: string,
    newPriority: Priority,
    newDueDate: string | null,
    tag_ids: number[],
  ) {
    const result = await apiFetch<{ todo: Todo; next_instance: Todo | null }>(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, priority: newPriority, due_date: newDueDate, tag_ids }),
    })
    setTodos((prev) => {
      const replaced = prev.map((todo) => (todo.id === id ? result.todo : todo))
      return result.next_instance ? [...replaced, result.next_instance] : replaced
    })
  }

  async function handleDelete(id: number) {
    setTodos((prev) => prev.filter((todo) => todo.id !== id))
    try {
      await apiFetch(`/api/todos/${id}`, { method: 'DELETE' })
    } catch {
      try {
        await fetchTodos()
      } catch {
        // Ignore fallback error
      }
    }
  }

  const filteredTodos =
    selectedTagFilter === null
      ? todos
      : todos.filter((todo) => todo.tags.some((tag) => tag.id === selectedTagFilter))

  const overdueTodos = filteredTodos.filter((todo) => isOverdue(todo))
  const activeTodos = filteredTodos.filter(
    (todo) => !todo.completed && !isOverdue(todo),
  )
  const completedTodos = filteredTodos.filter((todo) => todo.completed)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Todos</h1>
        <button
          onClick={requestPermission}
          className={`text-xs px-3 py-1.5 rounded-full font-medium border ${
            permission === 'granted'
              ? 'bg-green-100 text-green-700 border-green-300'
              : 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200'
          }`}
          disabled={permission === 'denied'}
          title={permission === 'denied' ? 'Notifications blocked in browser settings' : undefined}
        >
          {permission === 'granted' ? '🔔 Notifications on' : '🔔 Enable Notifications'}
        </button>
      </div>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          Manage Tags
        </h2>
        <form onSubmit={handleCreateTag} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => {
                setNewTagName(e.target.value)
                if (tagError) setTagError('')
              }}
              placeholder="Tag name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={50}
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="h-10 w-14 rounded border border-gray-300 bg-white"
              aria-label="Select tag color"
            />
            <button
              type="submit"
              disabled={creatingTag}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {creatingTag ? 'Adding...' : 'Add Tag'}
            </button>
          </div>
          {tagError && <p className="text-red-600 text-sm">{tagError}</p>}
        </form>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1"
              >
                <TagChip tag={tag} />
                <button
                  type="button"
                  onClick={() => handleEditTag(tag)}
                  className="rounded px-1 text-xs text-gray-600 hover:bg-white"
                  aria-label={`Edit tag ${tag.name}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag.id, tag.name)}
                  className="rounded px-1 text-xs text-red-600 hover:bg-white"
                  aria-label={`Delete tag ${tag.name}`}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          Filter By Tag
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTagFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              selectedTagFilter === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            All
          </button>
          {tags.map((tag) => {
            const active = selectedTagFilter === tag.id
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setSelectedTagFilter(tag.id)}
                className="rounded-full px-3 py-1 text-xs font-medium border"
                style={{
                  borderColor: active ? tag.color : '#D1D5DB',
                  backgroundColor: active ? tag.color : '#FFFFFF',
                  color: active ? getTagTextColor(tag.color) : '#374151',
                }}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      </section>

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (addError) setAddError('')
            }}
            placeholder="What needs to be done?"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={adding}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => {
            setDueDate(e.target.value)
            if (!e.target.value) {
              setReminderMinutes(null)
            }
          }}
          min={getMinFutureDate()}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(toPriority(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          <select
            value={reminderMinutes ?? ''}
            onChange={(e) => {
              if (!e.target.value) {
                setReminderMinutes(null)
                return
              }
              setReminderMinutes(Number(e.target.value))
            }}
            disabled={!dueDate}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">No reminder</option>
            {REMINDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            Repeat this todo
          </label>
          {isRecurring && (
            <select
              value={recurrencePattern}
              onChange={(e) => setRecurrencePattern(toRecurrencePattern(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Assign Tags</p>
          <TagSelector
            tags={tags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        </div>
        {addError && <p className="text-red-600 text-sm">{addError}</p>}
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filteredTodos.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">
          No todos match this filter.
        </p>
      ) : (
        <div className="space-y-6">
          <Section title="Overdue" count={overdueTodos.length} variant="overdue">
            {overdueTodos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onEdit={setEditingTodo}
                onDelete={handleDelete}
              />
            ))}
          </Section>

          <Section title="Active" count={activeTodos.length}>
            {activeTodos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onEdit={setEditingTodo}
                onDelete={handleDelete}
              />
            ))}
          </Section>

          <Section
            title="Completed"
            count={completedTodos.length}
            variant="completed"
            collapsible
          >
            {completedTodos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onEdit={setEditingTodo}
                onDelete={handleDelete}
              />
            ))}
          </Section>
        </div>
      )}

      {editingTodo && (
        <EditModal
          todo={editingTodo}
          availableTags={tags}
          onClose={() => setEditingTodo(null)}
          onSave={handleSaveEdit}
        />
      )}
    </main>
  )
}
