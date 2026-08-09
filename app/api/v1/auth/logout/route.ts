import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveBearerToken, revokeToken } from '@/lib/auth'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

export async function POST(req: NextRequest) {
  const raw = extractBearer(req)
  if (!raw) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'token_required' },
      { status: 401 },
    )
  }

  const resolved = await resolveBearerToken(raw)
  if (!resolved) {
    return NextResponse.json(
      { error_class: 'auth', error_code: 'token_required' },
      { status: 401 },
    )
  }

  await revokeToken({
    tokenId: resolved.tokenId,
    byUserId: resolved.userId,
    reason: 'logout',
  })

  return NextResponse.json({ ok: true })
}
