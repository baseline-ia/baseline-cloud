import { db } from '@/lib/db/client'
import { events } from '@/lib/db/schema'
import { and, eq, gte, lte, sql, count } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditUsageFilters {
  from: Date
  to: Date
  project?: string
  username?: string
}

export interface CreditUsageSummary {
  totalCredits: number
  totalSessions: number
  dailyAverage: number
  topProject: string | null
  topDeveloper: string | null
}

export interface CreditsByDay {
  date: string
  credits: number
  sessions: number
}

export interface CreditsByDeveloper {
  username: string
  credits: number
  sessions: number
}

export interface CreditsByProject {
  project: string
  credits: number
  sessions: number
}

export interface CreditUsageResult {
  summary: CreditUsageSummary
  byDay: CreditsByDay[]
  byDeveloper: CreditsByDeveloper[]
  byProject: CreditsByProject[]
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function getCreditUsage(filters: CreditUsageFilters): Promise<CreditUsageResult> {
  const conditions = [
    eq(events.eventType, 'session.credits'),
    gte(events.occurredAt, filters.from),
    lte(events.occurredAt, filters.to),
  ]

  if (filters.project) {
    conditions.push(eq(events.project, filters.project))
  }
  if (filters.username) {
    conditions.push(eq(events.username, filters.username))
  }

  const where = and(...conditions)

  const creditsExpr = sql<number>`COALESCE(SUM((${events.payload}->>'credits')::numeric), 0)`
  const sessionsExpr = count()
  const dayExpr = sql<string>`to_char(${events.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`

  // Run all three aggregations in parallel
  const [byDayRows, byDevRows, byProjRows] = await Promise.all([
    db
      .select({
        date: dayExpr,
        credits: creditsExpr,
        sessions: sessionsExpr,
      })
      .from(events)
      .where(where)
      .groupBy(dayExpr)
      .orderBy(dayExpr),

    db
      .select({
        username: events.username,
        credits: creditsExpr,
        sessions: sessionsExpr,
      })
      .from(events)
      .where(where)
      .groupBy(events.username)
      .orderBy(sql`${creditsExpr} DESC`),

    db
      .select({
        project: events.project,
        credits: creditsExpr,
        sessions: sessionsExpr,
      })
      .from(events)
      .where(where)
      .groupBy(events.project)
      .orderBy(sql`${creditsExpr} DESC`),
  ])

  // Normalize results
  const byDay: CreditsByDay[] = byDayRows.map((r) => ({
    date: r.date,
    credits: Math.round(Number(r.credits) * 1000) / 1000,
    sessions: Number(r.sessions),
  }))

  const byDeveloper: CreditsByDeveloper[] = byDevRows.map((r) => ({
    username: r.username,
    credits: Math.round(Number(r.credits) * 1000) / 1000,
    sessions: Number(r.sessions),
  }))

  const byProject: CreditsByProject[] = byProjRows.map((r) => ({
    project: r.project,
    credits: Math.round(Number(r.credits) * 1000) / 1000,
    sessions: Number(r.sessions),
  }))

  // Compute summary
  const totalCredits = byDay.reduce((sum, d) => sum + d.credits, 0)
  const totalSessions = byDay.reduce((sum, d) => sum + d.sessions, 0)
  const daysDiff = Math.max(
    1,
    Math.ceil((filters.to.getTime() - filters.from.getTime()) / (1000 * 60 * 60 * 24)),
  )
  const dailyAverage = Math.round((totalCredits / daysDiff) * 100) / 100

  const topProject = byProject[0]?.project ?? null
  const topDeveloper = byDeveloper[0]?.username ?? null

  return {
    summary: {
      totalCredits: Math.round(totalCredits * 1000) / 1000,
      totalSessions,
      dailyAverage,
      topProject,
      topDeveloper,
    },
    byDay,
    byDeveloper,
    byProject,
  }
}
