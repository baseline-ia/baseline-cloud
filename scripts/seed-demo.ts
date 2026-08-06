/**
 * Demo seed: populates the cloud with a realistic dataset so the
 * dashboard charts and metrics look meaningful.
 *
 * Run with: npx tsx scripts/seed-demo.ts
 *
 * Adds 5 more developers, ~200 events spread over 30 days, 6 changes
 * with mixed work types and per-change estimates, and ~20 skill
 * installations across multiple tools.
 */
import { nanoid } from 'nanoid';
import { hash } from 'bcrypt';
import { db } from '../src/db/client.js';
import { users, tokens, events, sessions } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  // Wipe existing data (keep schema, drop rows)
  console.log('• wiping existing data...');
  await db.delete(events);
  await db.delete(tokens);
  await db.delete(sessions);
  await db.delete(users);

  console.log('• creating 7 users...');
  const passwordHash = await hash('correct-horse-battery', 12);
  const userData = [
    { username: 'alice', email: 'alice@team.com', role: 'admin' as const },
    { username: 'bob', email: 'bob@team.com', role: 'member' as const },
    { username: 'carol', email: 'carol@team.com', role: 'member' as const },
    { username: 'dave', email: 'dave@team.com', role: 'member' as const },
    { username: 'eve', email: 'eve@team.com', role: 'member' as const },
    { username: 'frank', email: 'frank@team.com', role: 'member' as const },
    { username: 'grace', email: 'grace@team.com', role: 'member' as const },
  ];

  const userIds: Record<string, string> = {};
  for (const u of userData) {
    const id = nanoid(21);
    userIds[u.username] = id;
    await db.insert(users).values({
      id,
      username: u.username,
      email: u.email,
      passwordHash,
      role: u.role,
      enabled: true,
      lastLoginAt: new Date(),
    });
  }

  // ─────────── Skills installed (5 skills × 5 tools) ───────────
  console.log('• seeding 25 skill.installed events...');
  const skills = [
    'commit', 'review', 'refactor', 'test', 'document', 'refine-spec', 'scaffold', 'migrate',
  ];
  const tools = ['claude', 'opencode', 'kiro'];
  const usernames = Object.keys(userIds);

  const skillInserts: Array<typeof events.$inferInsert> = [];
  for (let i = 0; i < 35; i++) {
    const user = pick(usernames);
    const skill = pick(skills);
    const tool = pick(tools);
    const daysAgo = randInt(0, 28);
    skillInserts.push({
      id: nanoid(21),
      userId: userIds[user]!,
      username: user,
      project: 'default',
      eventType: 'skill.installed',
      payload: { skillName: skill, tool, scope: 'user' },
      occurredAt: new Date(Date.now() - daysAgo * DAY - randInt(0, HOUR * 12)),
    });
  }
  await db.insert(events).values(skillInserts);

  // ─────────── 6 changes (mix of work types, with/without estimates) ───────────
  console.log('• seeding 6 changes with full lifecycle...');

  interface ChangeDef {
    name: string;
    workType: 'feature' | 'migration' | 'fix' | 'chore' | 'refactor' | 'new-project';
    title: string;
    estimateMin?: number;
    bucket?: 'small' | 'medium' | 'large' | 'xlarge';
    owner: string;
    commits: number;
    durationDays: number;     // open → close
    closedDaysAgo: number;    // when it closed
    successRate: number;      // 0-1, fraction of events that succeed
  }

  const changes: ChangeDef[] = [
    // Each durationDays is intentionally LESS than estimateMin/1440 (in days)
    // so savedMin is positive and the dashboard shows real ROI.
    { name: 'add-stripe-webhook', workType: 'feature', title: 'Add Stripe webhook handler', estimateMin: 480, bucket: 'large', owner: 'alice', commits: 12, durationDays: 0.18, closedDaysAgo: 1, successRate: 0.9 },
    { name: 'migrate-engram-1.0', workType: 'migration', title: 'Migrate to engram 1.0 API', estimateMin: 360, bucket: 'medium', owner: 'dave', commits: 8, durationDays: 0.12, closedDaysAgo: 3, successRate: 0.85 },
    { name: 'fix-memory-leak', workType: 'fix', title: 'Fix memory leak in worker', owner: 'bob', commits: 3, durationDays: 0.08, closedDaysAgo: 5, successRate: 1 },
    { name: 'refactor-commands', workType: 'refactor', title: 'Refactor command dispatcher', estimateMin: 300, bucket: 'medium', owner: 'carol', commits: 6, durationDays: 0.10, closedDaysAgo: 7, successRate: 0.95 },
    { name: 'add-skill-dashboard', workType: 'feature', title: 'Add skill adoption dashboard', owner: 'eve', commits: 4, durationDays: 0.05, closedDaysAgo: 14, successRate: 1 },
    { name: 'scaffold-new-project', workType: 'new-project', title: 'Scaffold baseline-iam project', estimateMin: 240, bucket: 'large', owner: 'frank', commits: 1, durationDays: 0.06, closedDaysAgo: 21, successRate: 0.9 },
  ];

  const changeInserts: Array<typeof events.$inferInsert> = [];
  const allEventInserts: Array<typeof events.$inferInsert> = [];

  for (const c of changes) {
    const openedAt = new Date(Date.now() - c.closedDaysAgo * DAY - c.durationDays * DAY);
    const closedAt = new Date(openedAt.getTime() + c.durationDays * DAY);

    // change.open
    const openPayload: Record<string, unknown> = { changeName: c.name, workType: c.workType, title: c.title };
    if (c.estimateMin) {
      openPayload.estimateMin = c.estimateMin;
      openPayload.estimateSource = c.bucket ? 'bucket' : 'per-change';
      if (c.bucket) openPayload.estimateBucket = c.bucket;
    }
    allEventInserts.push({
      id: nanoid(21),
      userId: userIds[c.owner]!,
      username: c.owner,
      project: 'default',
      eventType: 'change.open',
      payload: openPayload,
      occurredAt: openedAt,
    });

    // change.commit × N (between open and close)
    for (let i = 0; i < c.commits; i++) {
      const commitAt = new Date(
        openedAt.getTime() + ((i + 1) * c.durationDays * DAY) / (c.commits + 1),
      );
      const filesChanged = randInt(1, 8);
      const linesAdded = randInt(10, 200);
      const linesRemoved = randInt(0, 100);
      allEventInserts.push({
        id: nanoid(21),
        userId: userIds[c.owner]!,
        username: c.owner,
        project: 'default',
        eventType: 'change.commit',
        payload: {
          changeName: c.name,
          sha: nanoid(40),
          shortSha: nanoid(7),
          message: pick(['feat: ', 'fix: ', 'chore: ', 'refactor: ']) + pick(['add endpoint', 'fix edge case', 'cleanup', 'rename', 'extract helper']),
          filesChanged,
          linesAdded,
          linesRemoved,
        },
        occurredAt: commitAt,
      });
    }

    // change.close
    const closePayload: Record<string, unknown> = {
      changeName: c.name,
      workType: c.workType,
      totalCommits: c.commits,
      durationMs: c.durationDays * DAY,
      verdict: Math.random() < c.successRate ? 'pass' : 'fail',
    };
    if (c.estimateMin) closePayload.estimateMin = c.estimateMin;
    allEventInserts.push({
      id: nanoid(21),
      userId: userIds[c.owner]!,
      username: c.owner,
      project: 'default',
      eventType: 'change.close',
      payload: closePayload,
      occurredAt: closedAt,
    });
  }
  await db.insert(events).values(allEventInserts);

  // ─────────── CLI command events (distributed across users and time) ───────────
  console.log('• seeding 180 CLI command events over 30 days...');
  const cliInserts: Array<typeof events.$inferInsert> = [];

  for (let i = 0; i < 180; i++) {
    const user = pick(usernames);
    const cmdType = pick(['cli.install', 'cli.doctor', 'cli.doctor', 'cli.status', 'cli.status', 'cli.mcp', 'cli.onboard']);
    const daysAgo = Math.random() < 0.7 ? randInt(0, 14) : randInt(15, 29); // 70% recent, 30% older

    let payload: Record<string, unknown> = {};
    if (cmdType === 'cli.install') {
      payload = { os: pick(['darwin', 'linux', 'win32']), nodeVersion: 'v20.0.0', toolsDetected: { claude: Math.random() > 0.3, opencode: Math.random() > 0.5 } };
    } else if (cmdType === 'cli.doctor') {
      const passed = randInt(3, 10);
      const failed = Math.random() < 0.15 ? randInt(1, 2) : 0;
      payload = { checksPassed: passed, checksFailed: failed, success: failed === 0, durationMs: randInt(100, 800) };
    } else if (cmdType === 'cli.status') {
      payload = { perTool: { claude: { installed: true, configured: true }, opencode: { installed: Math.random() > 0.4 } }, durationMs: randInt(50, 300) };
    } else if (cmdType === 'cli.mcp') {
      payload = { provider: pick(['jira', 'slack', 'github']), configured: 1, success: Math.random() > 0.1 };
    } else if (cmdType === 'cli.onboard') {
      payload = { level: pick(['junior', 'semi', 'senior']), durationMs: randInt(60000, 300000), success: true };
    }

    cliInserts.push({
      id: nanoid(21),
      userId: userIds[user]!,
      username: user,
      project: 'default',
      eventType: cmdType,
      payload,
      occurredAt: new Date(Date.now() - daysAgo * DAY - randInt(0, HOUR * 23)),
    });
  }
  await db.insert(events).values(cliInserts);

  // ─────────── openspec.open + openspec.update events (random distribution) ───────────
  console.log('• seeding 30 openspec events...');
  const openspecInserts: Array<typeof events.$inferInsert> = [];
  for (let i = 0; i < 30; i++) {
    const user = pick(usernames);
    const daysAgo = randInt(0, 29);
    const changeName = `scratch-${nanoid(6).toLowerCase()}`;
    const isUpdate = Math.random() < 0.4;
    openspecInserts.push({
      id: nanoid(21),
      userId: userIds[user]!,
      username: user,
      project: 'default',
      eventType: isUpdate ? 'openspec.update' : 'openspec.open',
      payload: isUpdate
        ? { changeName, artifact: pick(['proposal', 'spec', 'design', 'tasks']), op: 'updated' }
        : { changeName, type: pick(['feature', 'fix', 'chore']) },
      occurredAt: new Date(Date.now() - daysAgo * DAY - randInt(0, HOUR * 23)),
    });
  }
  await db.insert(events).values(openspecInserts);

  // Summary
  const [totalEvents] = await db.select({ c: sql<number>`count(*)` }).from(events);
  const [totalUsers] = await db.select({ c: sql<number>`count(*)` }).from(users);
  const [totalSkills] = await db.select({ c: sql<number>`count(*)` }).from(events).where(sql`event_type = 'skill.installed'`);
  const [totalChanges] = await db.select({ c: sql<number>`count(*)` }).from(events).where(sql`event_type = 'change.close'`);
  console.log('\n✅ Seed complete!');
  console.log(`   ${totalUsers.c} users, ${totalEvents.c} events, ${totalSkills.c} skill installations, ${totalChanges.c} closed changes`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
