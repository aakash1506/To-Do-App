import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'
import { setSessionCookie } from '@/lib/auth'

// Shared in-memory store — same map used in register-options
const challengeStore = new Map<string, string>()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { username, response } = body

  if (!username || !response) {
    return NextResponse.json({ error: 'username and response are required' }, { status: 400 })
  }

  const expectedChallenge = challengeStore.get(username)
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'No challenge found — start registration first' }, { status: 400 })
  }

  const user = userDB.findByUsername(username)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: process.env.ORIGIN ?? 'http://localhost:3000',
      expectedRPID: process.env.RP_ID ?? 'localhost',
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 })
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo

    authenticatorDB.create({
      user_id: user.id,
      credential_id: isoBase64URL.fromBuffer(credentialID),
      credential_public_key: isoBase64URL.fromBuffer(credentialPublicKey),
      counter: counter ?? 0,
      transports: null,
    })

    challengeStore.delete(username)
    await setSessionCookie({ userId: user.id, username: user.username })

    return NextResponse.json({ verified: true })
  } catch (err) {
    console.error('register-verify error:', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }
}
