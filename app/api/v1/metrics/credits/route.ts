import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveBearerToken } from '@/lib/auth'
import { getCreditUsage } from '@/lib/services/credits'

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  project: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
})

export async function GET(req: NextRequest) {
  // Auth
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
      { error_class: 'auth', error_code: 'token_invalid' },
      { status: 401 },
    )
  }

  // Parse query params
  const { searchParams } = new URL(req.url)
  const params = {
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    project: searchParams.get('project') ?? undefined,
    username: searchParams.get('username') ?? undefined,
  }

  const parsed = QuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error_class: 'validation',
        error_code: 'invalid_input',
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
      { status: 400 },
    )
  }

  const { from, to, project, username } = parsed.data

  // Build date range (from = start of day, to = end of day)
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T23:59:59.999Z`)

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_date' },
      { status: 400 },
    )
  }

  if (fromDate > toDate) {
    return NextResponse.json(
      { error_class: 'validation', error_code: 'invalid_range', error: '"from" must be before "to"' },
      { status: 400 },
    )
  }

  const result = await getCreditUsage({ from: fromDate, to: toDate, project, username })

  return NextResponse.json(result)
}
