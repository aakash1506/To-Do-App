'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { REMINDER_OPTIONS, formatReminderBadge } from '@/lib/reminders'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Todo {
  id: number
  title: string
  completed: boolean
  due_date: string | null
  reminder_minutes: number | null
  created_at: string
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMinFutureDate(): string {
  const now = new Date(Date.now() + 2 * 60 * 1000) // 2 min from now
  // Format: YYYY-MM-DDTHH:mm (required by datetime-local input)
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

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options)
  if (res.status === 204) return undefined as T
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data as T
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

interface EditModalProps {
  todo: Todo
  onClose: () => void
  onSave: (id: number, title: string, due_date: string | null, reminder_minutes: number | null) => Promise<void>
}

function EditModal({ todo, onClose, onSave }: EditModalProps) {
  const [title, setTitle] = useState(todo.title)
  const [dueDate, setDueDate] = useState(
    todo.due_date ? new Date(todo.due_date).toISOString().slice(0, 16) : '',
  )
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(todo.reminder_minutes)
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
      const due =
        dueDate
          ? new Date(dueDate).toISOString()
          : null
      await onSave(todo.id, title.trim(), due, dueDate ? reminderMinutes : null)
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
              Due Date (optional)
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                if (!e.target.value) setReminderMinutes(null)
              }}
              min={getMinFutureDate()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reminder (optional)
            </label>
            <select
              value={reminderMinutes ?? ''}
              onChange={(e) => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
              disabled={!dueDate}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">No reminder</option>
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
              {saving ? 'Saving…' : 'Save'}
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
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium break-words ${
            todo.completed ? 'line-through text-gray-400' : 'text-gray-800'
          }`}
        >
          {todo.title}
        </p>
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
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)

  const { permission, requestPermission } = useNotifications()

  // ── Fetch todos ──────────────────────────────────────────────────────────

  const fetchTodos = useCallback(async () => {
    try {
      const data = await apiFetch<{ todos: Todo[] }>('/api/todos')
      setTodos(data.todos)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  // ── Create todo ──────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setAddError('Title is required')
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
          due_date: due,
          reminder_minutes: dueDate ? reminderMinutes : null,
        }),
      })
      setTodos((prev) => [...prev, todo])
      setTitle('')
      setDueDate('')
      setReminderMinutes(null)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add todo')
    } finally {
      setAdding(false)
    }
  }

  // ── Toggle completion ────────────────────────────────────────────────────

  async function handleToggle(id: number, currentCompleted: boolean) {
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: !currentCompleted } : t,
      ),
    )
    try {
      await apiFetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted }),
      })
    } catch {
      // Rollback on error
      setTodos((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed: currentCompleted } : t,
        ),
      )
    }
  }

  // ── Update todo ──────────────────────────────────────────────────────────

  async function handleSaveEdit(
    id: number,
    newTitle: string,
    newDueDate: string | null,
    newReminderMinutes: number | null,
  ) {
    const updated = await apiFetch<Todo>(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        due_date: newDueDate,
        reminder_minutes: newReminderMinutes,
      }),
    })
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  // ── Delete todo ──────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    // Optimistic remove
    setTodos((prev) => prev.filter((t) => t.id !== id))
    try {
      await apiFetch(`/api/todos/${id}`, { method: 'DELETE' })
    } catch {
      // Refetch on error
      fetchTodos()
    }
  }

  // ── Derived lists ────────────────────────────────────────────────────────

  const overdueTodos = todos.filter((t) => isOverdue(t))
  const activeTodos = todos.filter((t) => !t.completed && !isOverdue(t))
  const completedTodos = todos.filter((t) => t.completed)

  // ── Render ───────────────────────────────────────────────────────────────

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

      {/* Add form */}
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
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => {
            setDueDate(e.target.value)
            if (!e.target.value) setReminderMinutes(null)
          }}
          min={getMinFutureDate()}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={reminderMinutes ?? ''}
          onChange={(e) => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
          disabled={!dueDate}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">No reminder</option>
          {REMINDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {addError && <p className="text-red-600 text-sm">{addError}</p>}
      </form>

      {/* Todo lists */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : todos.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">
          No todos yet. Add one above!
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

      {/* Edit modal */}
      {editingTodo && (
        <EditModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={handleSaveEdit}
        />
      )}
    </main>
  )
}
