/**
 * Metrics / ROI tests — the per-change estimate, admin default fallback,
 * ROI math, and aggregation correctness.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { testDb, schema } from './setup';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/server';
import {
  listChanges,
  getRoiSummary,
  getChangeTimeline,
  getOverviewStats,
  getSkillAdoption,
  setTimeBaselines,
  getTimeBaselines,
} from '../src/services/metrics';
import type { FastifyInstance } from 'fastify';

async function makeApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

async function signupAndToken(app: FastifyInstance, username = 'alice'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { username, email: `${username}@example.com`, password: 'correct-horse-battery' },
  });
  return res.json().token.raw as string;
}

async function postEvent(app: FastifyInstance, token: string, eventType: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/events',
    headers: { authorization: `Bearer ${token}` },
    payload: { event_type: eventType, project: 'default', payload },
  });
}

// ============================================================================
// Time baselines config
// ============================================================================

describe('Time baselines config', () => {
  it('returns defaults when no override is set', async () => {
    const baselines = await getTimeBaselines();
    expect(baselines.feature).toBe(480);
    expect(baselines.migration).toBe(360);
    expect(baselines['new-project']).toBe(240);
  });

  it('setTimeBaselines persists overrides', async () => {
    await setTimeBaselines({ feature: 100, migration: 50 });
    const baselines = await getTimeBaselines();
    expect(baselines.feature).toBe(100);
    expect(baselines.migration).toBe(50);
    // Unchanged types still get the default
    expect(baselines['new-project']).toBe(240);
  });
});

// ============================================================================
// getOverviewStats
// ============================================================================

describe('getOverviewStats', () => {
  it('returns zeros when there are no events', async () => {
    const stats = await getOverviewStats();
    expect(stats.totalEvents).toBe(0);
    expect(stats.totalEventsLast7d).toBe(0);
    expect(stats.activeDevsLast7d).toBe(0);
    expect(stats.totalDevs).toBe(0);
    expect(stats.errorRate).toBe(0);
  });

  it('counts events correctly', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');
    await postEvent(app, token, 'cli.install', { os: 'darwin' });
    await postEvent(app, token, 'cli.doctor', { checksPassed: 5, checksFailed: 0, success: true });
    await postEvent(app, token, 'cli.doctor', { checksPassed: 3, checksFailed: 2, success: false });

    const stats = await getOverviewStats();
    expect(stats.totalEvents).toBe(3);
    expect(stats.totalEventsLast7d).toBe(3);
    expect(stats.activeDevsLast7d).toBe(1);
    expect(stats.totalDevs).toBe(1);
    // 1 errored out of 3 total events = 33.3% error rate
    expect(stats.errorRate).toBe(33.3);
  });
});

// ============================================================================
// listChanges + per-change estimate (the ROI pipeline)
// ============================================================================

describe('listChanges — per-change estimate takes priority over admin default', () => {
  it('uses per-change estimate when present in the change.open event', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');

    // Open a change with an explicit estimate of 120 minutes
    await postEvent(app, token, 'change.open', {
      changeName: 'quick-fix',
      workType: 'fix',
      title: 'Quick fix',
      estimateMin: 120,
      estimateSource: 'per-change',
    });
    // Close it after 30 minutes of duration
    await postEvent(app, token, 'change.close', {
      changeName: 'quick-fix',
      workType: 'fix',
      totalCommits: 3,
      durationMs: 30 * 60 * 1000,
      verdict: 'pass',
    });

    const changes = await listChanges();
    expect(changes.length).toBe(1);
    const c = changes[0]!;
    expect(c.changeName).toBe('quick-fix');
    expect(c.workType).toBe('fix');
    expect(c.estimateSource).toBe('per-change');
    expect(c.estimatedBaselineMin).toBe(120); // NOT the admin default of 180
    expect(c.actualMin).toBe(30);
    expect(c.savedMin).toBe(90); // 120 - 30
    expect(c.roiPct).toBe(75); // 90/120 = 75%
  });

  it('falls back to admin default when no per-change estimate is provided', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');

    // Open a change WITHOUT an estimate
    await postEvent(app, token, 'change.open', {
      changeName: 'no-estimate-change',
      workType: 'fix',
    });
    // Close it after 60 minutes
    await postEvent(app, token, 'change.close', {
      changeName: 'no-estimate-change',
      workType: 'fix',
      totalCommits: 2,
      durationMs: 60 * 60 * 1000,
      verdict: 'pass',
    });

    const changes = await listChanges();
    const c = changes.find((x) => x.changeName === 'no-estimate-change')!;
    expect(c.estimateSource).toBe('admin-default');
    expect(c.estimatedBaselineMin).toBe(180); // admin default for 'fix'
    expect(c.actualMin).toBe(60);
    expect(c.savedMin).toBe(120);
    expect(c.roiPct).toBe(66.7); // 120/180 = 66.67% rounded
  });

  it('records the bucket when an estimate comes from a bucket', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');

    await postEvent(app, token, 'change.open', {
      changeName: 'bucket-change',
      workType: 'feature',
      estimateMin: 480,
      estimateSource: 'bucket',
      estimateBucket: 'large',
    });

    const changes = await listChanges();
    const c = changes.find((x) => x.changeName === 'bucket-change')!;
    expect(c.estimateSource).toBe('bucket');
    expect(c.estimateBucket).toBe('large');
    expect(c.estimatedBaselineMin).toBe(480);
  });

  it('respects admin-default overrides (e.g., raising the floor)', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');

    // Admin raises the feature baseline to 720 (12h)
    await setTimeBaselines({ feature: 720 });

    // Change has no estimate → uses the NEW default of 720
    await postEvent(app, token, 'change.open', { changeName: 'c1', workType: 'feature' });
    await postEvent(app, token, 'change.close', {
      changeName: 'c1', workType: 'feature', totalCommits: 0, durationMs: 4 * 60 * 60 * 1000, verdict: 'pass',
    });

    const changes = await listChanges();
    const c = changes[0]!;
    expect(c.estimateSource).toBe('admin-default');
    expect(c.estimatedBaselineMin).toBe(720); // overridden default
    expect(c.actualMin).toBe(240);
    expect(c.savedMin).toBe(480);
    expect(c.roiPct).toBe(66.7);
  });
});

// ============================================================================
// getRoiSummary (the headline number for the dashboard)
// ============================================================================

describe('getRoiSummary', () => {
  it('aggregates totalSavedMin, roiPct, byWorkType, byDeveloper', async () => {
    const app = await makeApp();
    const aliceToken = await signupAndToken(app, 'alice');
    const bobToken = await signupAndToken(app, 'bob');

    // Alice: 1 feature change, 100min actual, 480 baseline → +380 saved
    await postEvent(app, aliceToken, 'change.open', {
      changeName: 'feat-a', workType: 'feature', estimateMin: 480, estimateSource: 'per-change',
    });
    await postEvent(app, aliceToken, 'change.close', {
      changeName: 'feat-a', workType: 'feature', totalCommits: 0, durationMs: 100 * 60 * 1000, verdict: 'pass',
    });

    // Bob: 1 fix change, 60min actual, 180 baseline → +120 saved
    await postEvent(app, bobToken, 'change.open', {
      changeName: 'fix-b', workType: 'fix', estimateMin: 180, estimateSource: 'per-change',
    });
    await postEvent(app, bobToken, 'change.close', {
      changeName: 'fix-b', workType: 'fix', totalCommits: 0, durationMs: 60 * 60 * 1000, verdict: 'pass',
    });

    const summary = await getRoiSummary();
    expect(summary.closedChanges).toBe(2);
    expect(summary.totalActualMin).toBe(160); // 100 + 60
    expect(summary.totalEstimatedMin).toBe(660); // 480 + 180
    expect(summary.totalSavedMin).toBe(500); // 380 + 120
    // 500 / 660 = 75.75% → 75.8%
    expect(summary.roiPct).toBe(75.8);

    // By work type
    const featureRow = summary.byWorkType.find((r) => r.workType === 'feature')!;
    expect(featureRow.count).toBe(1);
    expect(featureRow.savedMin).toBe(380);
    const fixRow = summary.byWorkType.find((r) => r.workType === 'fix')!;
    expect(fixRow.count).toBe(1);
    expect(fixRow.savedMin).toBe(120);

    // By developer
    const aliceRow = summary.byDeveloper.find((r) => r.username === 'alice')!;
    expect(aliceRow.changes).toBe(1);
    expect(aliceRow.savedMin).toBe(380);
    const bobRow = summary.byDeveloper.find((r) => r.username === 'bob')!;
    expect(bobRow.changes).toBe(1);
    expect(bobRow.savedMin).toBe(120);
  });

  it('does not count open changes in savedMin / roiPct (only closed)', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');

    // Open a change but never close it
    await postEvent(app, token, 'change.open', {
      changeName: 'still-open', workType: 'feature', estimateMin: 480, estimateSource: 'per-change',
    });

    const summary = await getRoiSummary();
    expect(summary.closedChanges).toBe(0);
    expect(summary.openChanges).toBe(1);
    expect(summary.totalSavedMin).toBe(0);
    expect(summary.roiPct).toBe(0);
  });

  it('caps savedMin at 0 (never negative)', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');

    // A change that took 2x the estimate → "saved" should be 0, not negative
    await postEvent(app, token, 'change.open', {
      changeName: 'overrun', workType: 'fix', estimateMin: 60, estimateSource: 'per-change',
    });
    await postEvent(app, token, 'change.close', {
      changeName: 'overrun', workType: 'fix', totalCommits: 0, durationMs: 120 * 60 * 1000, verdict: 'fail',
    });

    const summary = await getRoiSummary();
    expect(summary.totalSavedMin).toBe(0);
    expect(summary.roiPct).toBe(0);
  });
});

// ============================================================================
// getChangeTimeline
// ============================================================================

describe('getChangeTimeline', () => {
  it('returns the opens, commits, and closes in order', async () => {
    const app = await makeApp();
    const token = await signupAndToken(app, 'alice');

    await postEvent(app, token, 'change.open', {
      changeName: 'my-change', workType: 'feature', estimateMin: 240, estimateSource: 'per-change',
    });
    // Simulate 3 commits (in real life these come from the post-commit hook)
    await postEvent(app, token, 'change.commit', {
      changeName: 'my-change', sha: 'aaaaaaa', shortSha: 'aaa', message: 'init',
      filesChanged: 1, linesAdded: 10, linesRemoved: 0,
    });
    await postEvent(app, token, 'change.commit', {
      changeName: 'my-change', sha: 'bbbbbbb', shortSha: 'bbb', message: 'feat: add stuff',
      filesChanged: 3, linesAdded: 50, linesRemoved: 5,
    });
    await postEvent(app, token, 'change.commit', {
      changeName: 'my-change', sha: 'ccccccc', shortSha: 'ccc', message: 'fix: bug',
      filesChanged: 1, linesAdded: 2, linesRemoved: 2,
    });
    await postEvent(app, token, 'change.close', {
      changeName: 'my-change', workType: 'feature', totalCommits: 3, durationMs: 60 * 60 * 1000, verdict: 'pass',
    });

    const timeline = await getChangeTimeline('my-change');
    expect(timeline.opens.length).toBe(1);
    expect(timeline.opens[0]?.workType).toBe('feature');
    expect(timeline.commits.length).toBe(3);
    expect(timeline.commits[0]?.shortSha).toBe('aaa');
    expect(timeline.commits[1]?.message).toBe('feat: add stuff');
    expect(timeline.commits[2]?.shortSha).toBe('ccc');
    expect(timeline.closes.length).toBe(1);
    expect(timeline.closes[0]?.verdict).toBe('pass');
  });

  it('returns empty timeline for unknown change', async () => {
    const timeline = await getChangeTimeline('does-not-exist');
    expect(timeline.opens).toHaveLength(0);
    expect(timeline.commits).toHaveLength(0);
    expect(timeline.closes).toHaveLength(0);
  });
});

// ============================================================================
// getSkillAdoption
// ============================================================================

describe('getSkillAdoption', () => {
  it('counts unique adopters per skill', async () => {
    const app = await makeApp();
    const aliceToken = await signupAndToken(app, 'alice');
    const bobToken = await signupAndToken(app, 'bob');

    // Alice installs 'commit' and 'review'
    await postEvent(app, aliceToken, 'skill.installed', { skillName: 'commit', tool: 'claude' });
    await postEvent(app, aliceToken, 'skill.installed', { skillName: 'review', tool: 'claude' });
    // Bob also installs 'commit'
    await postEvent(app, bobToken, 'skill.installed', { skillName: 'commit', tool: 'claude' });

    const adoption = await getSkillAdoption();
    const commit = adoption.find((r) => r.skillName === 'commit')!;
    const review = adoption.find((r) => r.skillName === 'review')!;
    expect(commit.adopters).toBe(2); // alice + bob
    expect(review.adopters).toBe(1); // only alice
  });

  it('returns empty list when no skills installed', async () => {
    const adoption = await getSkillAdoption();
    expect(adoption).toHaveLength(0);
  });
});
