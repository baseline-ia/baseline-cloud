import { db } from '../lib/db/client.ts';
import { events, users } from '../lib/db/schema.ts';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));
  return d;
}

async function seed() {
  // Get the first user to attach events to
  const userRows = await db.select().from(users).limit(2);
  if (userRows.length === 0) {
    console.error('No users found in DB. Create a user first.');
    process.exit(1);
  }

  const mainUser = userRows[0];
  const secondUser = userRows[1] ?? userRows[0];

  console.log(`Seeding events for users: ${mainUser.username}, ${secondUser.username}`);

  const newEvents: Array<{
    id: string;
    userId: string;
    username: string;
    project: string;
    eventType: string;
    payload: Record<string, unknown>;
    occurredAt: Date;
  }> = [];

  // =========================================================================
  // CHANGES (open, commit, close)
  // =========================================================================
  const changes = [
    { name: 'add-auth-module', workType: 'feature', daysAgoOpen: 25, daysAgoClose: 22, commits: 8 },
    { name: 'fix-token-expiry', workType: 'bugfix', daysAgoOpen: 20, daysAgoClose: 19, commits: 3 },
    { name: 'migrate-to-nextjs', workType: 'migration', daysAgoOpen: 18, daysAgoClose: 12, commits: 15 },
    { name: 'add-dashboard-charts', workType: 'feature', daysAgoOpen: 14, daysAgoClose: 10, commits: 6 },
    { name: 'refactor-metrics-service', workType: 'refactor', daysAgoOpen: 8, daysAgoClose: 6, commits: 4 },
    { name: 'token-accounting', workType: 'feature', daysAgoOpen: 1, daysAgoClose: null, commits: 2 },
  ];

  for (const change of changes) {
    const user = Math.random() > 0.4 ? mainUser : secondUser;

    // change.open
    newEvents.push({
      id: nanoid(21),
      userId: user.id,
      username: user.username,
      project: 'baseline-cloud',
      eventType: 'change.open',
      payload: {
        changeName: change.name,
        workType: change.workType,
        title: change.name.replace(/-/g, ' '),
        estimateMin: change.workType === 'feature' ? 480 : change.workType === 'bugfix' ? 120 : 960,
        estimateSource: 'per-change',
      },
      occurredAt: daysAgo(change.daysAgoOpen),
    });

    // change.commit events
    for (let i = 0; i < change.commits; i++) {
      const commitDay = change.daysAgoClose
        ? change.daysAgoOpen - Math.floor((change.daysAgoOpen - change.daysAgoClose) * (i / change.commits))
        : change.daysAgoOpen - i;
      newEvents.push({
        id: nanoid(21),
        userId: user.id,
        username: user.username,
        project: 'baseline-cloud',
        eventType: 'change.commit',
        payload: {
          changeName: change.name,
          sha: nanoid(8),
          message: `feat: ${change.name} step ${i + 1}`,
        },
        occurredAt: daysAgo(Math.max(0, commitDay)),
      });
    }

    // change.close (if closed)
    if (change.daysAgoClose !== null) {
      const openTime = daysAgo(change.daysAgoOpen).getTime();
      const closeTime = daysAgo(change.daysAgoClose).getTime();
      const durationMs = closeTime - openTime > 0 ? closeTime - openTime : 3600000 * 4;
      newEvents.push({
        id: nanoid(21),
        userId: user.id,
        username: user.username,
        project: 'baseline-cloud',
        eventType: 'change.close',
        payload: {
          changeName: change.name,
          durationMs: Math.abs(durationMs),
          verdict: 'merged',
        },
        occurredAt: daysAgo(change.daysAgoClose),
      });
    }
  }

  // =========================================================================
  // SKILLS (installed + used)
  // =========================================================================
  const skills = ['sdd-new', 'sdd-apply', 'judgment-day', 'branch-pr', 'frontend-design', 'changelog-generator'];

  for (const skill of skills) {
    newEvents.push({
      id: nanoid(21),
      userId: mainUser.id,
      username: mainUser.username,
      project: 'baseline-cloud',
      eventType: 'skill.installed',
      payload: { tool: skill, version: '1.0.0' },
      occurredAt: daysAgo(Math.floor(Math.random() * 28) + 2),
    });

    // Multiple uses per skill
    const uses = Math.floor(Math.random() * 8) + 2;
    for (let i = 0; i < uses; i++) {
      newEvents.push({
        id: nanoid(21),
        userId: Math.random() > 0.5 ? mainUser.id : secondUser.id,
        username: Math.random() > 0.5 ? mainUser.username : secondUser.username,
        project: Math.random() > 0.3 ? 'baseline-cloud' : 'design-system',
        eventType: 'skill.used',
        payload: { skillName: skill },
        occurredAt: daysAgo(Math.floor(Math.random() * 20)),
      });
    }
  }

  // =========================================================================
  // SESSION CREDITS (Kiro usage)
  // =========================================================================
  const projects = ['baseline-cloud', 'design-system', 'escuelas'];
  for (let day = 0; day < 30; day++) {
    const sessionsToday = Math.floor(Math.random() * 4) + 1;
    for (let s = 0; s < sessionsToday; s++) {
      const user = Math.random() > 0.4 ? mainUser : secondUser;
      const credits = Math.round((Math.random() * 15 + 1) * 1000) / 1000;
      newEvents.push({
        id: nanoid(21),
        userId: user.id,
        username: user.username,
        project: projects[Math.floor(Math.random() * projects.length)],
        eventType: 'session.credits',
        payload: {
          sessionId: nanoid(12),
          workspaceId: 'ws-' + nanoid(6),
          credits,
          turnsProcessed: Math.floor(Math.random() * 20) + 3,
          title: 'Kiro session',
          tool: 'kiro',
        },
        occurredAt: daysAgo(day),
      });
    }
  }

  // =========================================================================
  // SDD PHASES
  // =========================================================================
  const phases = ['explore', 'propose', 'spec', 'design', 'tasks', 'apply', 'verify'];
  for (const change of changes.slice(0, 4)) {
    for (const phase of phases) {
      const startedAt = daysAgo(change.daysAgoOpen - 1);
      const dur = Math.floor(Math.random() * 600) + 30;
      const completedAt = new Date(startedAt.getTime() + dur * 1000);
      newEvents.push({
        id: nanoid(21),
        userId: mainUser.id,
        username: mainUser.username,
        project: 'baseline-cloud',
        eventType: 'sdd.phase.completed',
        payload: {
          phase,
          change: change.name,
          project: 'baseline-cloud',
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationSeconds: dur,
        },
        occurredAt: completedAt,
      });
    }
  }

  // =========================================================================
  // INSERT
  // =========================================================================
  console.log(`Inserting ${newEvents.length} events...`);

  // Insert in batches of 50
  for (let i = 0; i < newEvents.length; i += 50) {
    const batch = newEvents.slice(i, i + 50);
    await db.insert(events).values(batch);
  }

  console.log('Done! Dashboard should now show data.');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
