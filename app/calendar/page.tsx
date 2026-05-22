'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface CalendarTodo {
  id: number
  title: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  due_date: string
}

interface Holiday {
  date: string
  name: string
}

const PRIORITY_COLORS = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getSGDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(() =>
    parseInt(today.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }).split('-')[0], 10)
  )
  const [month, setMonth] = useState(() =>
    parseInt(today.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }).split('-')[1], 10)
  )
  const [todos, setTodos] = useState<CalendarTodo[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [todosRes, holidaysRes] = await Promise.all([
      fetch('/api/todos'),
      fetch(`/api/holidays?year=${year}&month=${month}`),
    ])
    const todosData = await todosRes.json()
    const holidaysData = await holidaysRes.json()

    setTodos(
      (todosData.todos as CalendarTodo[]).filter((t) => t.due_date)
    )
    setHolidays(holidaysData.holidays ?? [])
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
    setSelectedDate(null)
  }

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const todayStr = getSGDate(new Date())
  const holidayMap = Object.fromEntries(holidays.map((h) => [h.date, h.name]))

  const todosForDate = (day: number) =>
    todos.filter((t) => getSGDate(new Date(t.due_date)) === dateStr(day))

  const selectedTodos = selectedDate
    ? todos.filter((t) => getSGDate(new Date(t.due_date)) === selectedDate)
    : []

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back</Link>
          <h1 className="text-2xl font-bold text-gray-800">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">‹</button>
          <span className="font-semibold text-gray-700 min-w-40 text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">›</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {DAYS.map((d) => (
            <div key={d} className="text-xs font-semibold text-gray-500 text-center py-2">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7 divide-x divide-y">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="min-h-20 bg-gray-50" />
            const ds = dateStr(day)
            const isToday = ds === todayStr
            const holiday = holidayMap[ds]
            const dayTodos = todosForDate(day)
            const isSelected = ds === selectedDate

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(isSelected ? null : ds)}
                className={`min-h-20 p-1.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                }`}>
                  {day}
                </div>
                {holiday && (
                  <div className="text-xs text-orange-600 font-medium truncate leading-tight mb-0.5">
                    🎉 {holiday}
                  </div>
                )}
                <div className="space-y-0.5">
                  {dayTodos.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-1 text-xs truncate ${
                        t.completed ? 'text-gray-400 line-through' : 'text-gray-700'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority]}`} />
                      {t.title}
                    </div>
                  ))}
                  {dayTodos.length > 3 && (
                    <div className="text-xs text-blue-600">+{dayTodos.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="font-semibold text-gray-800 mb-3">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-SG', { dateStyle: 'full' })}
            {holidayMap[selectedDate] && (
              <span className="ml-2 text-sm font-normal text-orange-600">
                🎉 {holidayMap[selectedDate]}
              </span>
            )}
          </h2>
          {selectedTodos.length === 0 ? (
            <p className="text-gray-400 text-sm">No todos due on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedTodos.map((t) => (
                <div key={t.id} className={`flex items-center gap-2 text-sm ${t.completed ? 'opacity-50' : ''}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority]}`} />
                  <span className={t.completed ? 'line-through text-gray-400' : 'text-gray-800'}>{t.title}</span>
                  {t.completed && <span className="text-xs text-gray-400">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
          <div key={p} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${c}`} />
            <span className="capitalize">{p}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span>🎉</span><span>Public holiday</span>
        </div>
      </div>
    </main>
  )
}
