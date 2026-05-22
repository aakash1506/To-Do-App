import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'

const challengeStore = new Map<string, string>()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 })

  const user = userDB.findByUsername(username)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const authenticators = authenticatorDB.findByUserId(user.id)
  if (authenticators.length === 0) {
    return NextResponse.json({ error: 'No credentials registered for this user' }, { status: 404 })
  }

  const options = await generateAuthenticationOptions({
    rpID: process.env.RP_ID ?? 'localhost',
    allowCredentials: authenticators.map((a) => ({
      id: isoBase64URL.toBuffer(a.credential_id),
      type: 'public-key' as const,
      transports: a.transports ? (JSON.parse(a.transports) as AuthenticatorTransport[]) : undefined,
    })),
    userVerification: 'preferred',
  })

  challengeStore.set(username, options.challenge)
  return NextResponse.json({ options, userId: user.id })
}

export { challengeStore }
