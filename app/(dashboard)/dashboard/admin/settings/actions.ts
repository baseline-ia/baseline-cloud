'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { resolveSession } from '@/lib/auth'
import { setTimeBaselines } from '@/lib/services/metrics'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const WORK_TYPES = ['feature', 'migration', 'new-project', 'chore', 'fix', 'refactor', 'docs'] as const

const BaselinesSchema = z.object(
  Object.fromEntries(
    WORK_TYPES.map((wt) => [wt, z.coerce.number().positive('Must be a positive number')]),
  ) as Record<typeof WORK_TYPES[number], z.ZodNumber>,
)

export async function updateBaselinesAction(
  _prevState: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const raw = Object.fromEntries(WORK_TYPES.map((wt) => [wt, formData.get(wt)]))

  const parsed = BaselinesSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    const field = firstError?.path[0] ?? 'value'
    return { error: `${field}: ${firstError?.message ?? 'Invalid value.'}` }
  }

  await setTimeBaselines(parsed.data as Record<string, number>, session.userId)

  revalidatePath('/dashboard/admin/settings')
  return { success: true }
}
