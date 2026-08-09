---
id: nextjs-migration-design
change: nextjs-migration
status: approved
---

## Architecture

```
baseline-cloud/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Route group — requires auth
│   │   ├── layout.tsx            # Auth guard + Navbar wrapper
│   │   ├── dashboard/page.tsx    # Redirects to /dashboard/overview
│   │   ├── overview/page.tsx     # [Phase 2]
│   │   ├── events/page.tsx       # [Phase 2]
│   │   ├── developers/page.tsx   # [Phase 2]
│   │   ├── changes/page.tsx      # [Phase 2]
│   │   ├── skills/page.tsx       # [Phase 2]
│   │   ├── activity/page.tsx     # [Phase 2]
│   │   └── admin/
│   │       ├── users/page.tsx    # [Phase 4]
│   │       ├── tokens/page.tsx   # [Phase 4]
│   │       └── settings/page.tsx # [Phase 4]
│   ├── api/
│   │   ├── health/route.ts       # GET /api/health ✅
│   │   ├── auth/logout/route.ts  # DELETE /api/auth/logout ✅
│   │   └── v1/                   # [Phase 3]
│   │       ├── events/route.ts
│   │       └── auth/
│   │           ├── login/route.ts
│   │           ├── signup/route.ts
│   │           ├── logout/route.ts
│   │           └── token/route.ts
│   ├── login/
│   │   ├── page.tsx              # ✅
│   │   ├── login-form.tsx        # 'use client' ✅
│   │   └── actions.ts            # Server Action ✅
│   ├── globals.css               # Design system + Tailwind ✅
│   └── layout.tsx                # Root layout, fonts ✅
├── components/
│   ├── layout/
│   │   ├── navbar.tsx            # Two-tier Server Component ✅
│   │   └── theme-toggle.tsx      # 'use client' island ✅
│   └── ui/                       # shadcn/ui primitives ✅
│       ├── badge.tsx, button.tsx, card.tsx
│       ├── dropdown-menu.tsx, input.tsx, label.tsx
│       ├── select.tsx, separator.tsx
│       └── [chart.tsx, table.tsx, ...] # [Phase 2+]
├── lib/
│   ├── auth/index.ts             # HMAC token logic (port) ✅
│   ├── config.ts                 # Env vars (PORT/HOST/LOG_LEVEL removed) ✅
│   ├── db/
│   │   ├── client.ts             # postgres.js pool ✅
│   │   ├── migrate.ts            # Drizzle migrate() ✅
│   │   ├── schema.ts             # Exact copy from src/db/schema.ts ✅
│   │   └── migrations/           # Symlinked or copied from src/db/migrations
│   ├── i18n/index.ts             # i18n helper (Fastify types removed) ✅
│   ├── services/metrics.ts       # Metrics queries ✅
│   └── utils.ts                  # shadcn cn() utility ✅
├── middleware.ts                 # Auth protection for /dashboard/* ✅
├── next.config.ts                # standalone output ✅
├── tailwind.config.ts            # ✅
├── components.json               # shadcn config ✅
└── drizzle.config.ts             # Updated paths ✅
```

## Key Design Decisions

### Server Components as default
All dashboard pages are RSCs — they fetch data directly from the DB via `lib/services/metrics.ts` and render HTML server-side. No client-side data fetching for the primary page content. Client Components (`'use client'`) are only used for interactive islands (login form, theme toggle, user dropdown, chart animations).

### Server Actions for mutations
Admin forms (create user, create token, update settings) use Server Actions (`'use server'` functions) instead of REST endpoints. This eliminates the need for a separate API layer for UI-driven mutations. Validation happens in the action before DB write.

### Auth via cookie middleware
`middleware.ts` runs on the Edge and checks the `token` cookie on every `/dashboard/*` request. It verifies the token using `lib/auth/index.ts` and redirects to `/login` if invalid. This is the single enforcement point — individual pages don't re-check auth.

### Route groups for layout scoping
`app/(dashboard)/` is a Next.js route group. Its `layout.tsx` applies the auth guard and Navbar to all dashboard routes without affecting the URL structure. Login page is outside the group and has no auth check.

### shadcn/ui copy model
Components are copied into `components/ui/` — not imported from `node_modules`. This means full control over styling, no version lock for component internals.

### Design token bridge
`app/globals.css` defines both the existing CSS custom properties (`--primary`, `--border`, etc.) and the shadcn CSS variable names. This keeps visual continuity with the existing design while making shadcn components work natively.

### Recharts over Chart.js
Recharts is React-native — components, props, responsive containers. No `useRef`/`useEffect` canvas wiring. All chart data is passed as props from RSC. Charts are Client Components for interactivity (tooltips, animations).

### DB migrations
`lib/db/migrations/` starts empty (`.gitkeep`). The actual migration SQL files from `src/db/migrations/` are copied here during Phase 5 cleanup. Until then, the existing migrations run from `src/` path via the old Drizzle config.

## Data Flow

```
Browser → middleware.ts (Edge: verify token cookie)
       → RSC page → lib/services/metrics.ts → lib/db/client.ts → PostgreSQL
       → RSC renders HTML → streamed to browser

Browser form → Server Action → lib/db/client.ts → revalidatePath() → RSC re-render
```

## Component Patterns

### Dashboard page template
```tsx
// app/(dashboard)/overview/page.tsx
import { getUser } from '@/lib/auth'
import { getMetrics } from '@/lib/services/metrics'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ActivityChart } from '@/components/dashboard/activity-chart'

export default async function OverviewPage() {
  const [metrics, activity] = await Promise.all([
    getMetrics(), getActivity()
  ])
  return (
    <div className="...">
      <KpiCard ... />
      <ActivityChart data={activity} /> {/* 'use client' */}
    </div>
  )
}
```

### Server Action template
```tsx
// app/(dashboard)/admin/users/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

export async function createUser(formData: FormData) {
  // validate → hash → insert → revalidate
  revalidatePath('/dashboard/admin/users')
}
```
