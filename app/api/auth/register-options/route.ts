import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'

// In-memory challenge store — replace with Redis/DB in production
const challengeStore = new Map<string, string>()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 })

  // Get or create user
  let user = userDB.findByUsername(username)
  if (!user) {
    user = userDB.create(username, username)
  }

  const authenticators = authenticatorDB.findByUserId(user.id)

  const options = await generateRegistrationOptions({
    rpName: 'Todo App',
    rpID: process.env.RP_ID ?? 'localhost',
    userID: String(user.id),
    userName: user.username,
    userDisplayName: user.display_name,
    attestationType: 'none',
    excludeCredentials: authenticators.map((a) => ({
      id: isoBase64URL.toBuffer(a.credential_id),
      type: 'public-key' as const,
      transports: a.transports ? (JSON.parse(a.transports) as AuthenticatorTransport[]) : undefined,
    })),
  })

  challengeStore.set(username, options.challenge)
  return NextResponse.json({ options, userId: user.id })
}

// Export for use by verify route
export { challengeStore }
