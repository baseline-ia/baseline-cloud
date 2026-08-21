'use client'

import { useState } from 'react'
import { Image, Clock, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const SECTIONS = [
  { id: 'branding', label: 'Branding', icon: Image },
  { id: 'baselines', label: 'Time Baselines', icon: Clock },
  { id: 'theme', label: 'Theme', icon: Palette },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

interface SettingsShellProps {
  children: {
    branding: React.ReactNode
    baselines: React.ReactNode
    theme: React.ReactNode
  }
}

export function SettingsShell({ children }: SettingsShellProps) {
  const [active, setActive] = useState<SectionId>('branding')

  return (
    <div className="flex gap-6 min-h-[480px]">
      {/* Section Nav */}
      <nav
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-col w-48 shrink-0"
      >
        <div className="flex flex-col gap-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                role="tab"
                aria-selected={active === section.id}
                aria-controls={`settings-panel-${section.id}`}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                  active === section.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => setActive(section.id)}
              >
                <Icon size={16} aria-hidden />
                <span>{section.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <Separator orientation="vertical" className="h-auto" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            id={`settings-panel-${section.id}`}
            role="tabpanel"
            aria-labelledby={section.id}
            hidden={active !== section.id}
          >
            {children[section.id]}
          </div>
        ))}
      </div>
    </div>
  )
}
