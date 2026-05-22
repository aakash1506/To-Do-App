'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'

  const [username, setUsername] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) { setError('Username is required'); return }
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await register(username.trim().toLowerCase())
      } else {
        await login(username.trim().toLowerCase())
      }
      router.push(redirect)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  async function register(uname: string) {
    const optRes = await fetch('/api/auth/register-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname }),
    })
    if (!optRes.ok) throw new Error((await optRes.json()).error)
    const { options } = await optRes.json()

    const credential = await startRegistration({ optionsJSON: options })

    const verifyRes = await fetch('/api/auth/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, response: credential }),
    })
    if (!verifyRes.ok) throw new Error((await verifyRes.json()).error)
  }

  async function login(uname: string) {
    const optRes = await fetch('/api/auth/login-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname }),
    })
    if (!optRes.ok) throw new Error((await optRes.json()).error)
    const { options } = await optRes.json()

    const credential = await startAuthentication({ optionsJSON: options })

    const verifyRes = await fetch('/api/auth/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname, response: credential }),
    })
    if (!verifyRes.ok) throw new Error((await verifyRes.json()).error)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Todo App</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in with your passkey</p>
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 font-medium capitalize transition-colors ${
                mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              placeholder="Enter username"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username webauthn"
              autoFocus
            />
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>🔑</span>
            )}
            {loading ? 'Processing…' : mode === 'login' ? 'Sign in with Passkey' : 'Register Passkey'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center">
          Passwordless authentication using WebAuthn / Passkeys
        </p>
      </div>
    </main>
  )
}
