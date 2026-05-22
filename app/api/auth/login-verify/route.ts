import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { userDB, authenticatorDB } from '@/lib/db'
import { setSessionCookie } from '@/lib/auth'

const challengeStore = new Map<string, string>()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { username, response } = body

  if (!username || !response) {
    return NextResponse.json({ error: 'username and response are required' }, { status: 400 })
  }

  const expectedChallenge = challengeStore.get(username)
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'No challenge found — start login first' }, { status: 400 })
  }

  const user = userDB.findByUsername(username)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const authenticator = authenticatorDB.findByCredentialId(response.id)
  if (!authenticator || authenticator.user_id !== user.id) {
    return NextResponse.json({ error: 'Authenticator not found' }, { status: 404 })
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: process.env.ORIGIN ?? 'http://localhost:3000',
      expectedRPID: process.env.RP_ID ?? 'localhost',
      authenticator: {
        credentialID: isoBase64URL.toBuffer(authenticator.credential_id),
        credentialPublicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: authenticator.transports
          ? (JSON.parse(authenticator.transports) as AuthenticatorTransport[])
          : undefined,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication verification failed' }, { status: 400 })
    }

    authenticatorDB.updateCounter(authenticator.id, verification.authenticationInfo.newCounter ?? 0)
    challengeStore.delete(username)
    await setSessionCookie({ userId: user.id, username: user.username })

    return NextResponse.json({ verified: true })
  } catch (err) {
    console.error('login-verify error:', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }
}
