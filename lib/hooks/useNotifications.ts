'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Todo } from '@/lib/db'

const POLL_INTERVAL_MS = 30_000

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')

  // Sync permission state on mount (browser APIs only available client-side)
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  // Poll for due notifications when permission is granted
  useEffect(() => {
    if (permission !== 'granted') return

    async function checkAndFire() {
      try {
        const res = await fetch('/api/notifications/check')
        if (!res.ok) return
        const data = (await res.json()) as { todos: Todo[] }
        for (const todo of data.todos) {
          new Notification(todo.title, {
            body: todo.due_date
              ? `Due: ${new Date(todo.due_date).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`
              : 'Your task is due soon',
            icon: '/favicon.ico',
          })
        }
      } catch {
        // Network errors are non-fatal — silently skip
      }
    }

    checkAndFire()
    const timerId = setInterval(checkAndFire, POLL_INTERVAL_MS)
    return () => clearInterval(timerId)
  }, [permission])

  return { permission, requestPermission }
}
