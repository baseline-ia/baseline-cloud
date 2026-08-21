'use client'

import { useActionState } from 'react'
import { updateBaselinesAction } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const WORK_TYPES = ['feature', 'migration', 'new-project', 'chore', 'fix', 'refactor', 'docs'] as const

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

interface SettingsFormProps {
  baselines: Record<string, number>
}

export function SettingsForm({ baselines }: SettingsFormProps) {
  const [state, action, pending] = useActionState(updateBaselinesAction, {})

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {WORK_TYPES.map((wt) => (
          <div key={wt} className="space-y-2">
            <Label htmlFor={`baseline-${wt}`}>{capitalize(wt)}</Label>
            <div className="relative">
              <Input
                id={`baseline-${wt}`}
                name={wt}
                type="number"
                min={1}
                step={1}
                required
                defaultValue={baselines[wt] ?? 60}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                min
              </span>
            </div>
          </div>
        ))}
      </div>

      {state.error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm font-medium px-3 py-2">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium px-3 py-2">
          Settings saved successfully.
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  )
}
