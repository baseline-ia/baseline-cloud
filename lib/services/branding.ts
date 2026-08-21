import { db } from '@/lib/db/client'
import { settings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const LOGO_KEY = 'branding.logo'
const MAX_LOGO_SIZE = 512 * 1024 // 512KB

export interface BrandingLogo {
  dataUrl: string
  filename: string
  uploadedAt: string
}

export async function getBrandingLogo(): Promise<BrandingLogo | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, LOGO_KEY)).limit(1)
  const row = rows[0]
  if (!row?.value) return null
  return row.value as BrandingLogo
}

export async function setBrandingLogo(
  dataUrl: string,
  filename: string,
  userId: string,
): Promise<void> {
  // Validate size (base64 is ~33% larger than raw)
  const base64Part = dataUrl.split(',')[1] ?? ''
  const sizeBytes = Math.ceil(base64Part.length * 0.75)
  if (sizeBytes > MAX_LOGO_SIZE) {
    throw new Error('Logo must be under 512KB')
  }

  const value: BrandingLogo = {
    dataUrl,
    filename,
    uploadedAt: new Date().toISOString(),
  }

  await db
    .insert(settings)
    .values({ key: LOGO_KEY, value, updatedBy: userId })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date(), updatedBy: userId },
    })
}

export async function removeBrandingLogo(userId: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, LOGO_KEY))
}
