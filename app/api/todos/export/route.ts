import { NextResponse } from 'next/server'
import { todoDB, subtaskDB, tagDB } from '@/lib/db'

export async function GET() {
  const todos = todoDB.findAll(1)
  const result = todos.map((todo) => ({
    ...todo,
    subtasks: subtaskDB.findByTodo(todo.id),
    tags: tagDB.findByTodo(todo.id),
  }))
  return NextResponse.json({ todos: result, exportedAt: new Date().toISOString() })
}
