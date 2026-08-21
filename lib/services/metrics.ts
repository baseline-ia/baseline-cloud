import { and, count, countDistinct, desc, eq, gte, lte, ilike, or, sql, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { events, users, settings } from '@/lib/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

function sinceMs(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export interface DateRange {
  from: Date;
  to: Date;
}

export function dateRangeFromDays(days: number): DateRange {
  return { from: sinceMs(days), to: new Date() };
}

function rangeCondition(range: DateRange) {
  return and(gte(events.occurredAt, range.from), lte(events.occurredAt, range.to));
}

export interface OverviewStats {
  totalEvents: number;
  totalEventsLast7d: number;
  totalEventsLast30d: number;
  activeDevsLast24h: number;
  activeDevsLast7d: number;
  totalDevs: number;
  topEventTypes: Array<{ eventType: string; count: number }>;
  topProjects: Array<{ project: string; count: number }>;
  errorRate: number; // % of events with success=false
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const totalRow = (await db.select({ c: count() }).from(events))[0];
  const last7dRow = (await db.select({ c: count() }).from(events).where(gte(events.occurredAt, sinceMs(7))))[0];
  const last30dRow = (
    await db.select({ c: count() }).from(events).where(gte(events.occurredAt, sinceMs(30)))
  )[0];
  const active24hRow = (
    await db
      .select({ c: countDistinct(events.userId) })
      .from(events)
      .where(gte(events.occurredAt, sinceMs(1)))
  )[0];
  const active7dRow = (
    await db
      .select({ c: countDistinct(events.userId) })
      .from(events)
      .where(gte(events.occurredAt, sinceMs(7)))
  )[0];
  const totalDevsRow = (await db.select({ c: count() }).from(users))[0];

  const topTypes = await db
    .select({ eventType: events.eventType, c: count() })
    .from(events)
    .where(gte(events.occurredAt, sinceMs(7)))
    .groupBy(events.eventType)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const topProjects = await db
    .select({ project: events.project, c: count() })
    .from(events)
    .where(gte(events.occurredAt, sinceMs(7)))
    .groupBy(events.project)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  // Error rate: events whose payload has success=false / total events (last 7d)
  const errRow = (
    await db
      .select({ c: count() })
      .from(events)
      .where(
        and(
          gte(events.occurredAt, sinceMs(7)),
          sql`(${events.payload}->>'success')::boolean = false`,
        ),
      )
  )[0];
  const total7d = last7dRow?.c ?? 0;
  const err7d = errRow?.c ?? 0;
  const errorRate = total7d > 0 ? (err7d / total7d) * 100 : 0;

  return {
    totalEvents: totalRow?.c ?? 0,
    totalEventsLast7d: total7d,
    totalEventsLast30d: last30dRow?.c ?? 0,
    activeDevsLast24h: active24hRow?.c ?? 0,
    activeDevsLast7d: active7dRow?.c ?? 0,
    totalDevs: totalDevsRow?.c ?? 0,
    topEventTypes: topTypes.map((r) => ({ eventType: r.eventType, count: r.c })),
    topProjects: topProjects.map((r) => ({ project: r.project, count: r.c })),
    errorRate: Math.round(errorRate * 10) / 10,
  };
}

export interface RecentEvent {
  id: string;
  username: string;
  eventType: string;
  project: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export const EVENT_LIST_PAGE_SIZE = 50;

export interface RecentEventsParams {
  search: string;
  page: number;
}

export interface RecentEventsPage {
  rows: RecentEvent[];
  total: number;
  page: number;
  totalPages: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRecentEventsParams(params: SearchParams): RecentEventsParams {
  const search = firstParam(params.q)?.trim() ?? '';
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10);

  return {
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function recentEventsWhere(search: string) {
  if (!search) return undefined;

  const searchPattern = `%${search}%`;
  return or(
    ilike(events.project, searchPattern),
    ilike(events.eventType, searchPattern),
    ilike(events.username, searchPattern),
  );
}

export async function getRecentEvents(limit = 50): Promise<RecentEvent[]> {
  const rows = await db.select().from(events).orderBy(desc(events.occurredAt)).limit(limit);
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    eventType: r.eventType,
    project: r.project,
    payload: r.payload,
    occurredAt: r.occurredAt,
  }));
}

export async function getRecentEventsPage(params: RecentEventsParams): Promise<RecentEventsPage> {
  const where = recentEventsWhere(params.search);
  const countRows = await db.select({ c: count() }).from(events).where(where);
  const total = Number(countRows[0]?.c ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / EVENT_LIST_PAGE_SIZE));
  const page = Math.min(params.page, totalPages);

  const rows = await db
    .select({
      id: events.id,
      username: events.username,
      eventType: events.eventType,
      project: events.project,
      payload: events.payload,
      occurredAt: events.occurredAt,
    })
    .from(events)
    .where(where)
    .orderBy(desc(events.occurredAt))
    .limit(EVENT_LIST_PAGE_SIZE)
    .offset((page - 1) * EVENT_LIST_PAGE_SIZE);

  return { rows, total, page, totalPages };
}

export interface DeveloperStats {
  username: string;
  totalEvents: number;
  lastSeenAt: Date | null;
  topCommands: Array<{ eventType: string; count: number }>;
  errorRate: number;
}

export const DEVELOPER_LIST_PAGE_SIZE = 50;

export interface DeveloperStatsParams {
  search: string;
  page: number;
}

export interface DeveloperStatsPage {
  rows: DeveloperStats[];
  total: number;
  page: number;
  totalPages: number;
}

export function parseDeveloperStatsParams(params: SearchParams): DeveloperStatsParams {
  const search = firstParam(params.q)?.trim() ?? '';
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10);
  return {
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export async function getDeveloperStats(): Promise<DeveloperStats[]> {
  const rows = await db
    .select({
      username: events.username,
      totalEvents: count(),
      lastSeenAt: sql<Date | null>`max(${events.occurredAt})`,
    })
    .from(events)
    .where(gte(events.occurredAt, sinceMs(30)))
    .groupBy(events.username)
    .orderBy(sql`count(*) desc`);

  const stats: DeveloperStats[] = [];
  for (const r of rows) {
    const topCommands = await db
      .select({ eventType: events.eventType, c: count() })
      .from(events)
      .where(and(eq(events.username, r.username), gte(events.occurredAt, sinceMs(30))))
      .groupBy(events.eventType)
      .orderBy(sql`count(*) desc`)
      .limit(3);

    const [errRow] = await db
      .select({ c: count() })
      .from(events)
      .where(
        and(
          eq(events.username, r.username),
          gte(events.occurredAt, sinceMs(30)),
          sql`(${events.payload}->>'success')::boolean = false`,
        ),
      );
    const [totalRow] = await db
      .select({ c: count() })
      .from(events)
      .where(and(eq(events.username, r.username), gte(events.occurredAt, sinceMs(30))));

    const errCount = errRow?.c ?? 0;
    const totalCount = totalRow?.c ?? 0;

    stats.push({
      username: r.username,
      totalEvents: r.totalEvents,
      lastSeenAt: r.lastSeenAt,
      topCommands: topCommands.map((t) => ({ eventType: t.eventType, count: t.c })),
      errorRate: totalCount > 0 ? Math.round((errCount / totalCount) * 1000) / 10 : 0,
    });
  }
  return stats;
}

export async function getDeveloperStatsPage(
  params: DeveloperStatsParams,
): Promise<DeveloperStatsPage> {
  const since = sinceMs(30);
  const searchWhere = params.search ? ilike(events.username, `%${params.search}%`) : undefined;
  const where = and(gte(events.occurredAt, since), searchWhere);
  const countRows = await db
    .select({ total: countDistinct(events.username) })
    .from(events)
    .where(where);
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / DEVELOPER_LIST_PAGE_SIZE));
  const page = Math.min(params.page, totalPages);
  const rows = await db
    .select({
      username: events.username,
      totalEvents: count(),
      lastSeenAt: sql<Date | null>`max(${events.occurredAt})`,
    })
    .from(events)
    .where(where)
    .groupBy(events.username)
    .orderBy(sql`count(*) desc`)
    .limit(DEVELOPER_LIST_PAGE_SIZE)
    .offset((page - 1) * DEVELOPER_LIST_PAGE_SIZE);

  const stats: DeveloperStats[] = [];
  for (const row of rows) {
    const developerWhere = and(eq(events.username, row.username), gte(events.occurredAt, since));
    const topCommands = await db
      .select({ eventType: events.eventType, c: count() })
      .from(events)
      .where(developerWhere)
      .groupBy(events.eventType)
      .orderBy(sql`count(*) desc`)
      .limit(3);
    const [errRow] = await db
      .select({ c: count() })
      .from(events)
      .where(and(developerWhere, sql`(${events.payload}->>'success')::boolean = false`));
    const errCount = Number(errRow?.c ?? 0);
    const totalCount = Number(row.totalEvents ?? 0);

    stats.push({
      username: row.username,
      totalEvents: row.totalEvents,
      lastSeenAt: row.lastSeenAt,
      topCommands: topCommands.map((command) => ({ eventType: command.eventType, count: command.c })),
      errorRate: totalCount > 0 ? Math.round((errCount / totalCount) * 1000) / 10 : 0,
    });
  }

  return { rows: stats, total, page, totalPages };
}

export async function getDeveloperDetail(username: string) {
  const recent = await db
    .select()
    .from(events)
    .where(eq(events.username, username))
    .orderBy(desc(events.occurredAt))
    .limit(50);

  const byType = await db
    .select({ eventType: events.eventType, c: count() })
    .from(events)
    .where(eq(events.username, username))
    .groupBy(events.eventType)
    .orderBy(sql`count(*) desc`);

  const byProject = await db
    .select({ project: events.project, c: count() })
    .from(events)
    .where(eq(events.username, username))
    .groupBy(events.project)
    .orderBy(sql`count(*) desc`);

  const lastSeenRow = (
    await db
      .select({ lastSeenAt: sql<Date | null>`max(${events.occurredAt})` })
      .from(events)
      .where(eq(events.username, username))
  )[0];

  return { recent, byType, byProject, lastSeenAt: lastSeenRow?.lastSeenAt ?? null };
}

// ============================================================================
// Charts: time series, distributions, top-N
// ============================================================================

export interface DayPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

// ============================================================================
// Time aggregations (the overview's new focus: projects + time, not events)
// ============================================================================

export interface TimeAggregates {
  totalMs: number;
  closedChanges: number;
  byProject: Array<{ key: string; totalMs: number }>;
  byDeveloper: Array<{ key: string; totalMs: number }>;
  byWorkType: Array<{ key: string; totalMs: number }>;
  projectCount: number;
}

/**
 * Time spent on closed changes, aggregated by project / developer / work type.
 * Joins change.open (workType, project, username) with change.close
 * (durationMs) on the changeName in the payload. This is the new
 * "project + time" focus of the overview (replaces event-counting).
 */
export async function getTimeAggregates(days: number): Promise<TimeAggregates> {
  const since = sinceMs(days);

  const opens = await db
    .select()
    .from(events)
    .where(and(eq(events.eventType, 'change.open'), gte(events.occurredAt, since)));

  const closes = await db
    .select()
    .from(events)
    .where(and(eq(events.eventType, 'change.close'), gte(events.occurredAt, since)));

  // Map changeName → workType (from the open event)
  const workTypeByChange = new Map<string, string>();
  for (const o of opens) {
    const name = (o.payload as { changeName?: string }).changeName;
    const wt = (o.payload as { workType?: string }).workType;
    if (name && wt) workTypeByChange.set(name, wt);
  }

  // Build change records (join close + open by changeName)
  const records: Array<{ workType: string; project: string; username: string; durationMs: number }> = [];
  for (const c of closes) {
    const payload = c.payload as { changeName?: string; durationMs?: number };
    const name = payload.changeName;
    if (!name) continue;
    const durationMs = payload.durationMs ?? 0;
    records.push({
      workType: workTypeByChange.get(name) ?? 'unknown',
      project: c.project,
      username: c.username,
      durationMs,
    });
  }

  // Group + sum
  const totalMs = records.reduce((s, r) => s + r.durationMs, 0);
  const byProject = groupSum(records, (r) => r.project, (r) => r.durationMs);
  const byDeveloper = groupSum(records, (r) => r.username, (r) => r.durationMs);
  const byWorkType = groupSum(records, (r) => r.workType, (r) => r.durationMs);

  return {
    totalMs,
    closedChanges: closes.length,
    byProject: byProject.sort((a, b) => b.totalMs - a.totalMs),
    byDeveloper: byDeveloper.sort((a, b) => b.totalMs - a.totalMs),
    byWorkType: byWorkType.sort((a, b) => b.totalMs - a.totalMs),
    projectCount: new Set(records.map((r) => r.project)).size,
  };
}

export async function getActiveProjectCount(days: number): Promise<number> {
  const since = sinceMs(days);
  const rows = await db
    .selectDistinct({ project: events.project })
    .from(events)
    .where(gte(events.occurredAt, since));
  return rows.length;
}

function groupSum<T>(
  items: T[],
  keyFn: (t: T) => string,
  valFn: (t: T) => number,
): Array<{ key: string; totalMs: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) ?? 0) + valFn(item));
  }
  return Array.from(map.entries()).map(([key, totalMs]) => ({ key, totalMs }));
}

export async function getEventsPerDay(days: number): Promise<DayPoint[]> {
  const since = sinceMs(days);
  const dayExpr = sql<string>`to_char(${events.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day: dayExpr, c: count() })
    .from(events)
    .where(gte(events.occurredAt, since))
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  // Fill in missing days with 0
  const map = new Map(rows.map((r) => [r.day, Number(r.c)]));
  const out: DayPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export async function getEventsByType(days: number): Promise<Array<{ eventType: string; count: number }>> {
  const rows = await db
    .select({ eventType: events.eventType, c: count() })
    .from(events)
    .where(gte(events.occurredAt, sinceMs(days)))
    .groupBy(events.eventType)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({ eventType: r.eventType, count: Number(r.c) }));
}

export async function getTopDevelopers(
  days: number,
  limit = 10,
): Promise<Array<{ username: string; count: number }>> {
  const rows = await db
    .select({ username: events.username, c: count() })
    .from(events)
    .where(gte(events.occurredAt, sinceMs(days)))
    .groupBy(events.username)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((r) => ({ username: r.username, count: Number(r.c) }));
}

export async function getRoiByWorkType(): Promise<
  Array<{ workType: string; count: number; savedMin: number }>
> {
  const changes = await listChanges();
  const closed = changes.filter((c) => c.closedAt !== null);
  const map = new Map<string, { count: number; savedMin: number }>();
  for (const c of closed) {
    const m = map.get(c.workType) ?? { count: 0, savedMin: 0 };
    m.count += 1;
    m.savedMin += c.savedMin ?? 0;
    map.set(c.workType, m);
  }
  return Array.from(map.entries())
    .map(([workType, v]) => ({
      workType,
      count: v.count,
      savedMin: Math.round(v.savedMin * 10) / 10,
    }))
    .sort((a, b) => b.savedMin - a.savedMin);
}

export async function getTimeSavedByChange(): Promise<
  Array<{ name: string; savedMin: number; roiPct: number | null }>
> {
  const changes = await listChanges();
  return changes
    .filter((c) => c.closedAt !== null)
    .map((c) => ({ name: c.changeName, savedMin: c.savedMin ?? 0, roiPct: c.roiPct }))
    .sort((a, b) => b.savedMin - a.savedMin);
}

// ============================================================================
// Time tracking & ROI
// ============================================================================

// Default time baselines (minutes) per work type. These are the "estimated
// time WITHOUT baseline" numbers. Admins can override via the dashboard.
const DEFAULT_TIME_BASELINES_MIN: Record<string, number> = {
  feature: 480, // 8h
  migration: 360, // 6h
  'new-project': 240, // 4h
  chore: 60, // 1h
  fix: 180, // 3h
  refactor: 300, // 5h
  docs: 120, // 2h
};

export async function getTimeBaselines(): Promise<Record<string, number>> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, 'time_baselines_min')).limit(1)
  )[0];
  if (!row) return DEFAULT_TIME_BASELINES_MIN;
  try {
    const stored = JSON.parse(JSON.stringify(row.value)) as Record<string, number>;
    return { ...DEFAULT_TIME_BASELINES_MIN, ...stored };
  } catch {
    return DEFAULT_TIME_BASELINES_MIN;
  }
}

export async function setTimeBaselines(
  baselines: Record<string, number>,
  byUserId?: string,
): Promise<void> {
  await db
    .insert(settings)
    .values({ key: 'time_baselines_min', value: baselines, updatedBy: byUserId ?? null })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: baselines, updatedAt: new Date(), updatedBy: byUserId ?? null },
    });
}

export interface ChangeRecord {
  changeName: string;
  username: string;
  workType: string;
  title?: string;
  openedAt: Date;
  closedAt: Date | null;
  durationMs: number | null;
  totalCommits: number;
  estimatedBaselineMin: number;
  estimateSource: 'per-change' | 'admin-default' | 'bucket';
  estimateBucket?: string;
  actualMin: number | null;
  savedMin: number | null;
  roiPct: number | null;
}

export const CHANGE_LIST_PAGE_SIZE = 50;

export interface ChangesParams {
  search: string;
  page: number;
}

export interface ChangesPage {
  rows: ChangeRecord[];
  total: number;
  closed: number;
  open: number;
  page: number;
  totalPages: number;
}

export function parseChangesParams(params: SearchParams): ChangesParams {
  const search = firstParam(params.q)?.trim() ?? '';
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10);

  return {
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export interface ChangeTimeline {
  opens: Array<{ at: Date; workType: string; title?: string }>;
  closes: Array<{ at: Date; durationMs: number; verdict?: string }>;
  commits: Array<{
    at: Date;
    sha: string;
    shortSha: string;
    message: string;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
  }>;
}

export async function listChanges(): Promise<ChangeRecord[]> {
  const baselines = await getTimeBaselines();

  // Get all change.open events
  const opens = await db
    .select()
    .from(events)
    .where(eq(events.eventType, 'change.open'))
    .orderBy(asc(events.occurredAt));

  // Get all change.close events
  const closes = await db.select().from(events).where(eq(events.eventType, 'change.close'));

  // Count commits per change
  const commitRows = await db
    .select({
      changeName: sql<string | null>`${events.payload}->>'changeName'`,
      c: count(),
    })
    .from(events)
    .where(eq(events.eventType, 'change.commit'))
    .groupBy(sql`${events.payload}->>'changeName'`);

  const commitCounts = new Map<string, number>();
  for (const r of commitRows) {
    if (r.changeName) commitCounts.set(r.changeName, r.c);
  }

  const closeByChange = new Map<string, { at: Date; durationMs: number; verdict?: string }>();
  for (const c of closes) {
    const payload = c.payload as { changeName?: string; durationMs?: number; verdict?: string };
    if (payload.changeName) {
      closeByChange.set(payload.changeName, {
        at: c.occurredAt,
        durationMs: payload.durationMs ?? 0,
        verdict: payload.verdict,
      });
    }
  }

  const records: ChangeRecord[] = [];
  const seenChanges = new Set<string>();
  for (const o of opens) {
    const payload = o.payload as {
      changeName?: string;
      workType?: string;
      title?: string;
      estimateMin?: number;
      estimateSource?: 'per-change' | 'admin-default' | 'bucket';
      estimateBucket?: string;
    };
    const name = payload.changeName;
    if (!name) continue;
    if (seenChanges.has(name)) continue;
    seenChanges.add(name);
    const workType = payload.workType ?? 'feature';
    const close = closeByChange.get(name);
    const totalCommits = commitCounts.get(name) ?? 0;
    // Per-change estimate (from frontmatter / --estimate flag) takes priority
    // over the admin default. If absent, fall back to the admin default for
    // the work type.
    const hasPerChangeEstimate = typeof payload.estimateMin === 'number' && payload.estimateMin > 0;
    const estimatedBaselineMin = hasPerChangeEstimate
      ? payload.estimateMin!
      : (baselines[workType] ?? baselines.feature ?? 480);
    const estimateSource: ChangeRecord['estimateSource'] = hasPerChangeEstimate
      ? (payload.estimateSource ?? 'per-change')
      : 'admin-default';
    const actualMin = close ? close.durationMs / 60_000 : null;
    const savedMin = actualMin !== null ? Math.max(0, estimatedBaselineMin - actualMin) : null;
    const roiPct =
      actualMin !== null && estimatedBaselineMin > 0
        ? Math.round((savedMin! / estimatedBaselineMin) * 1000) / 10
        : null;
    records.push({
      changeName: name,
      username: o.username,
      workType,
      title: payload.title,
      openedAt: o.occurredAt,
      closedAt: close?.at ?? null,
      durationMs: close?.durationMs ?? null,
      totalCommits,
      estimatedBaselineMin,
      estimateSource,
      estimateBucket: payload.estimateBucket,
      actualMin: actualMin !== null ? Math.round(actualMin * 10) / 10 : null,
      savedMin: savedMin !== null ? Math.round(savedMin * 10) / 10 : null,
      roiPct,
    });
  }
  return records;
}

export async function listChangesPage(params: ChangesParams): Promise<ChangesPage> {
  const baselines = await getTimeBaselines();
  const changeName = sql<string | null>`${events.payload}->>'changeName'`;
  const latestCloseAt = sql<Date | null>`(
    SELECT max(close_event.occurred_at)
    FROM events AS close_event
    WHERE close_event.event_type = 'change.close'
      AND close_event.payload->>'changeName' = ${changeName}
  )`;
  const latestDurationMs = sql<number | null>`(
    SELECT NULLIF(close_event.payload->>'durationMs', '')::double precision
    FROM events AS close_event
    WHERE close_event.event_type = 'change.close'
      AND close_event.payload->>'changeName' = ${changeName}
    ORDER BY close_event.occurred_at DESC
    LIMIT 1
  )`;
  const commitCount = sql<number>`(
    SELECT count(*)
    FROM events AS commit_event
    WHERE commit_event.event_type = 'change.commit'
      AND commit_event.payload->>'changeName' = ${changeName}
  )`;
  const searchPattern = `%${params.search}%`;
  const searchWhere = params.search
    ? or(
        sql`${changeName} ILIKE ${searchPattern}`,
        ilike(events.project, searchPattern),
        ilike(events.username, searchPattern),
      )
    : undefined;
  const where = and(
    eq(events.eventType, 'change.open'),
    sql`${changeName} IS NOT NULL`,
    searchWhere,
  );

  // Deduplicate: count distinct change names only
  const countRows = await db
    .select({
      total: sql<number>`count(DISTINCT ${events.payload}->>'changeName')`,
      closed: sql<number>`count(DISTINCT ${events.payload}->>'changeName') FILTER (WHERE ${latestCloseAt} IS NOT NULL)`,
    })
    .from(events)
    .where(where);
  const total = Number(countRows[0]?.total ?? 0);
  const closed = Number(countRows[0]?.closed ?? 0);
  const open = total - closed;
  const totalPages = Math.max(1, Math.ceil(total / CHANGE_LIST_PAGE_SIZE));
  const page = Math.min(params.page, totalPages);

  // Use a subquery to get one row per changeName (earliest open event)
  const rawRows = await db.execute(sql`
    SELECT DISTINCT ON (payload->>'changeName')
      payload->>'changeName' AS "changeName",
      username,
      project,
      payload->>'workType' AS "workType",
      payload->>'title' AS title,
      NULLIF(payload->>'estimateMin', '')::double precision AS "estimateMin",
      payload->>'estimateSource' AS "estimateSource",
      payload->>'estimateBucket' AS "estimateBucket",
      occurred_at AS "openedAt",
      (SELECT max(ce.occurred_at) FROM events ce WHERE ce.event_type = 'change.close' AND ce.payload->>'changeName' = events.payload->>'changeName') AS "closedAt",
      (SELECT NULLIF(ce.payload->>'durationMs', '')::double precision FROM events ce WHERE ce.event_type = 'change.close' AND ce.payload->>'changeName' = events.payload->>'changeName' ORDER BY ce.occurred_at DESC LIMIT 1) AS "durationMs",
      (SELECT count(*) FROM events ce WHERE ce.event_type = 'change.commit' AND ce.payload->>'changeName' = events.payload->>'changeName') AS "totalCommits"
    FROM events
    WHERE event_type = 'change.open'
      AND payload->>'changeName' IS NOT NULL
      ${params.search ? sql`AND (payload->>'changeName' ILIKE ${searchPattern} OR username ILIKE ${searchPattern} OR project ILIKE ${searchPattern})` : sql``}
    ORDER BY payload->>'changeName', occurred_at ASC
    LIMIT ${CHANGE_LIST_PAGE_SIZE}
    OFFSET ${(page - 1) * CHANGE_LIST_PAGE_SIZE}
  `);

  const rows = rawRows as unknown as Array<{
    changeName: string;
    username: string;
    project: string;
    workType: string | null;
    title: string | null;
    estimateMin: number | null;
    estimateSource: string | null;
    estimateBucket: string | null;
    openedAt: Date;
    closedAt: Date | null;
    durationMs: number | null;
    totalCommits: number;
  }>;

  const records: ChangeRecord[] = rows.map((row) => {
    const workType = row.workType ?? 'feature';
    const hasPerChangeEstimate = typeof row.estimateMin === 'number' && row.estimateMin > 0;
    const estimatedBaselineMin = hasPerChangeEstimate
      ? row.estimateMin!
      : (baselines[workType] ?? baselines.feature ?? 480);
    const estimateSource: ChangeRecord['estimateSource'] = hasPerChangeEstimate
      ? ((row.estimateSource as ChangeRecord['estimateSource']) ?? 'per-change')
      : 'admin-default';
    const actualMin = row.closedAt && row.durationMs !== null ? row.durationMs / 60_000 : null;
    const savedMin = actualMin !== null ? Math.max(0, estimatedBaselineMin - actualMin) : null;
    const roiPct =
      actualMin !== null && estimatedBaselineMin > 0
        ? Math.round((savedMin! / estimatedBaselineMin) * 1000) / 10
        : null;

    return {
      changeName: row.changeName!,
      username: row.username,
      workType,
      title: row.title ?? undefined,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      durationMs: row.durationMs,
      totalCommits: Number(row.totalCommits ?? 0),
      estimatedBaselineMin,
      estimateSource,
      estimateBucket: row.estimateBucket ?? undefined,
      actualMin: actualMin !== null ? Math.round(actualMin * 10) / 10 : null,
      savedMin: savedMin !== null ? Math.round(savedMin * 10) / 10 : null,
      roiPct,
    };
  });

  return { rows: records, total, closed, open, page, totalPages };
}

export interface RoiSummary {
  totalChanges: number;
  closedChanges: number;
  openChanges: number;
  totalCommits: number;
  totalActualMin: number;
  totalEstimatedMin: number;
  totalSavedMin: number;
  roiPct: number;
  byWorkType: Array<{ workType: string; count: number; savedMin: number }>;
  byDeveloper: Array<{ username: string; changes: number; savedMin: number }>;
}

export async function getRoiSummary(): Promise<RoiSummary> {
  const changes = await listChanges();
  const closed = changes.filter((c) => c.closedAt !== null);
  const totalActualMin = closed.reduce((s, c) => s + (c.actualMin ?? 0), 0);
  const totalEstimatedMin = closed.reduce((s, c) => s + c.estimatedBaselineMin, 0);
  const totalSavedMin = closed.reduce((s, c) => s + (c.savedMin ?? 0), 0);
  const totalCommits = changes.reduce((s, c) => s + c.totalCommits, 0);

  const byWorkType = new Map<string, { count: number; savedMin: number }>();
  for (const c of closed) {
    const m = byWorkType.get(c.workType) ?? { count: 0, savedMin: 0 };
    m.count += 1;
    m.savedMin += c.savedMin ?? 0;
    byWorkType.set(c.workType, m);
  }

  const byDeveloper = new Map<string, { changes: number; savedMin: number }>();
  for (const c of closed) {
    const m = byDeveloper.get(c.username) ?? { changes: 0, savedMin: 0 };
    m.changes += 1;
    m.savedMin += c.savedMin ?? 0;
    byDeveloper.set(c.username, m);
  }

  return {
    totalChanges: changes.length,
    closedChanges: closed.length,
    openChanges: changes.length - closed.length,
    totalCommits,
    totalActualMin: Math.round(totalActualMin * 10) / 10,
    totalEstimatedMin: Math.round(totalEstimatedMin * 10) / 10,
    totalSavedMin: Math.round(totalSavedMin * 10) / 10,
    roiPct:
      totalEstimatedMin > 0 ? Math.round((totalSavedMin / totalEstimatedMin) * 1000) / 10 : 0,
    byWorkType: Array.from(byWorkType.entries())
      .map(([workType, v]) => ({
        workType,
        count: v.count,
        savedMin: Math.round(v.savedMin * 10) / 10,
      }))
      .sort((a, b) => b.savedMin - a.savedMin),
    byDeveloper: Array.from(byDeveloper.entries())
      .map(([username, v]) => ({
        username,
        changes: v.changes,
        savedMin: Math.round(v.savedMin * 10) / 10,
      }))
      .sort((a, b) => b.savedMin - a.savedMin),
  };
}

export async function getChangeTimeline(changeName: string): Promise<ChangeTimeline> {
  const opens = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.eventType, 'change.open'),
        sql`${events.payload}->>'changeName' = ${changeName}`,
      ),
    )
    .orderBy(asc(events.occurredAt));

  const closes = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.eventType, 'change.close'),
        sql`${events.payload}->>'changeName' = ${changeName}`,
      ),
    )
    .orderBy(asc(events.occurredAt));

  const commits = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.eventType, 'change.commit'),
        sql`${events.payload}->>'changeName' = ${changeName}`,
      ),
    )
    .orderBy(asc(events.occurredAt));

  return {
    opens: opens.map((o) => {
      const p = o.payload as { workType?: string; title?: string };
      return { at: o.occurredAt, workType: p.workType ?? 'feature', title: p.title };
    }),
    closes: closes.map((c) => {
      const p = c.payload as { durationMs?: number; verdict?: string };
      return { at: c.occurredAt, durationMs: p.durationMs ?? 0, verdict: p.verdict };
    }),
    commits: commits.map((c) => {
      const p = c.payload as {
        sha?: string;
        shortSha?: string;
        message?: string;
        filesChanged?: number;
        linesAdded?: number;
        linesRemoved?: number;
      };
      return {
        at: c.occurredAt,
        sha: p.sha ?? '',
        shortSha: p.shortSha ?? '',
        message: p.message ?? '',
        filesChanged: p.filesChanged ?? 0,
        linesAdded: p.linesAdded ?? 0,
        linesRemoved: p.linesRemoved ?? 0,
      };
    }),
  };
}

// ============================================================================
// Skills tracking
// ============================================================================

export interface SkillAdoptionRow {
  skillName: string;
  tool: string;
  adopters: number;
  lastInstalledAt: Date | null;
}

export const SKILL_ADOPTION_PAGE_SIZE = 50;

export interface SkillAdoptionParams {
  search: string;
  page: number;
}

export interface SkillAdoptionPage {
  rows: SkillAdoptionRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function parseSkillAdoptionParams(params: SearchParams): SkillAdoptionParams {
  const search = firstParam(params.q)?.trim() ?? '';
  const parsedPage = Number.parseInt(firstParam(params.page) ?? '1', 10);
  return {
    search,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export async function getSkillAdoption(): Promise<SkillAdoptionRow[]> {
  const rows = await db
    .select({
      skillName: sql<string>`${events.payload}->>'skillName'`,
      tool: sql<string>`${events.payload}->>'tool'`,
      adopters: countDistinct(events.userId),
      lastInstalledAt: sql<Date | null>`max(${events.occurredAt})`,
    })
    .from(events)
    .where(eq(events.eventType, 'skill.installed'))
    .groupBy(sql`${events.payload}->>'skillName'`, sql`${events.payload}->>'tool'`)
    .orderBy(sql`${countDistinct(events.userId)} desc`);

  return rows
    .filter((r) => r.skillName !== null)
    .map((r) => ({
      skillName: r.skillName!,
      tool: r.tool ?? 'unknown',
      adopters: r.adopters,
      lastInstalledAt: r.lastInstalledAt,
    }));
}

export async function getSkillAdoptionPage(
  params: SkillAdoptionParams,
): Promise<SkillAdoptionPage> {
  const skillName = sql<string>`${events.payload}->>'skillName'`;
  const tool = sql<string>`${events.payload}->>'tool'`;
  const searchPattern = `%${params.search}%`;
  const searchWhere = params.search
    ? or(sql`${skillName} ILIKE ${searchPattern}`, sql`${tool} ILIKE ${searchPattern}`)
    : undefined;
  const where = and(eq(events.eventType, 'skill.installed'), sql`${skillName} IS NOT NULL`, searchWhere);
  const groupedSkills = db
    .select({ skillName, tool })
    .from(events)
    .where(where)
    .groupBy(skillName, tool)
    .as('skill_adoption_groups');
  const countRows = await db.select({ total: count() }).from(groupedSkills);
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / SKILL_ADOPTION_PAGE_SIZE));
  const page = Math.min(params.page, totalPages);
  const rows = await db
    .select({
      skillName,
      tool,
      adopters: countDistinct(events.userId),
      lastInstalledAt: sql<Date | null>`max(${events.occurredAt})`,
    })
    .from(events)
    .where(where)
    .groupBy(skillName, tool)
    .orderBy(sql`${countDistinct(events.userId)} desc`)
    .limit(SKILL_ADOPTION_PAGE_SIZE)
    .offset((page - 1) * SKILL_ADOPTION_PAGE_SIZE);

  return {
    rows: rows.map((row) => ({
      skillName: row.skillName!,
      tool: row.tool ?? 'unknown',
      adopters: row.adopters,
      lastInstalledAt: row.lastInstalledAt,
    })),
    total,
    page,
    totalPages,
  };
}


// ---------------------------------------------------------------------------
// Range-based variants for dashboard date picker
// ---------------------------------------------------------------------------

export async function getOverviewStatsForRange(range: DateRange): Promise<OverviewStats> {
  const rangeWhere = rangeCondition(range);
  const totalRow = (await db.select({ c: count() }).from(events).where(rangeWhere))[0];
  const activeDevsRow = (
    await db
      .select({ c: countDistinct(events.userId) })
      .from(events)
      .where(rangeWhere)
  )[0];
  const totalDevsRow = (await db.select({ c: count() }).from(users))[0];

  const topTypes = await db
    .select({ eventType: events.eventType, c: count() })
    .from(events)
    .where(rangeWhere)
    .groupBy(events.eventType)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const topProjects = await db
    .select({ project: events.project, c: count() })
    .from(events)
    .where(rangeWhere)
    .groupBy(events.project)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const errRow = (
    await db
      .select({ c: count() })
      .from(events)
      .where(
        and(
          rangeWhere,
          sql`(${events.payload}->>'success')::boolean = false`,
        ),
      )
  )[0];

  const totalInRange = totalRow?.c ?? 0;
  const err = errRow?.c ?? 0;
  const errorRate = totalInRange > 0 ? (err / totalInRange) * 100 : 0;

  return {
    totalEvents: totalInRange,
    totalEventsLast7d: totalInRange,
    totalEventsLast30d: totalInRange,
    activeDevsLast24h: activeDevsRow?.c ?? 0,
    activeDevsLast7d: activeDevsRow?.c ?? 0,
    totalDevs: totalDevsRow?.c ?? 0,
    topEventTypes: topTypes.map((r) => ({ eventType: r.eventType, count: r.c })),
    topProjects: topProjects.map((r) => ({ project: r.project, count: r.c })),
    errorRate: Math.round(errorRate * 10) / 10,
  };
}

export async function getEventsPerDayForRange(range: DateRange): Promise<DayPoint[]> {
  const rangeWhere = rangeCondition(range);
  const dayExpr = sql<string>`to_char(${events.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day: dayExpr, c: count() })
    .from(events)
    .where(rangeWhere)
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  const map = new Map(rows.map((r) => [r.day, Number(r.c)]));
  const out: DayPoint[] = [];
  const days = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / DAY_MS));
  for (let i = 0; i < days; i++) {
    const d = new Date(range.from.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export async function getTimeAggregatesForRange(range: DateRange): Promise<TimeAggregates> {
  const rangeWhere = rangeCondition(range);

  const opens = await db
    .select()
    .from(events)
    .where(and(eq(events.eventType, 'change.open'), rangeWhere));

  const closes = await db
    .select()
    .from(events)
    .where(and(eq(events.eventType, 'change.close'), rangeWhere));

  const workTypeByChange = new Map<string, string>();
  for (const o of opens) {
    const name = (o.payload as { changeName?: string }).changeName;
    const wt = (o.payload as { workType?: string }).workType;
    if (name && wt) workTypeByChange.set(name, wt);
  }

  const records: Array<{ workType: string; project: string; username: string; durationMs: number }> = [];
  for (const c of closes) {
    const payload = c.payload as { changeName?: string; durationMs?: number };
    const name = payload.changeName;
    if (!name) continue;
    records.push({
      workType: workTypeByChange.get(name) ?? 'unknown',
      project: c.project,
      username: c.username,
      durationMs: payload.durationMs ?? 0,
    });
  }

  const totalMs = records.reduce((s, r) => s + r.durationMs, 0);
  const byProject = groupSum(records, (r) => r.project, (r) => r.durationMs);
  const byDeveloper = groupSum(records, (r) => r.username, (r) => r.durationMs);
  const byWorkType = groupSum(records, (r) => r.workType, (r) => r.durationMs);

  return {
    totalMs,
    closedChanges: closes.length,
    byProject: byProject.sort((a, b) => b.totalMs - a.totalMs),
    byDeveloper: byDeveloper.sort((a, b) => b.totalMs - a.totalMs),
    byWorkType: byWorkType.sort((a, b) => b.totalMs - a.totalMs),
    projectCount: new Set(records.map((r) => r.project)).size,
  };
}
