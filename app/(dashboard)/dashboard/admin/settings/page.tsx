import { Settings } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveSession } from '@/lib/auth'
import { getTimeBaselines } from '@/lib/services/metrics'
import { getBrandingLogo } from '@/lib/services/branding'
import { SettingsForm } from './settings-form'
import { LogoUploadForm } from './logo-upload-form'
import { ThemePalettePicker } from '@/components/layout/theme-palette-picker'
import { SettingsShell } from './settings-shell'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const session = await resolveSession(cookieStore.get('baseline_dashboard_session')?.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const [baselines, logo] = await Promise.all([getTimeBaselines(), getBrandingLogo()])

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={22} />
          Settings
        </h1>
        <p className="subtitle">Workspace-level configuration.</p>
      </div>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-6 shadow-sm transition-colors duration-200">
          <SettingsShell>
            {{
              branding: (
                <SettingsSection
                  title="Logo"
                  description="Upload a custom logo to replace the default in the sidebar."
                >
                  <LogoUploadForm currentLogo={logo} />
                </SettingsSection>
              ),
              baselines: (
                <SettingsSection
                  title="Time Baselines"
                  description="Default estimated minutes per work type when no per-change estimate is provided."
                >
                  <SettingsForm baselines={baselines} />
                </SettingsSection>
              ),
              theme: (
                <SettingsSection
                  title="Theme Palette"
                  description="Customize base color, accent color, and chart palette. Saved per browser."
                >
                  <ThemePalettePicker />
                </SettingsSection>
              ),
            }}
          </SettingsShell>
      </div>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}
