// Event type definitions shared by CLI and cloud.
// Keep this in sync with src/types/events.ts in ams-base-ai.

export const EVENT_TYPES = [
  // CLI command events
  'cli.install',
  'cli.update',
  'cli.doctor',
  'cli.status',
  'cli.mcp',
  'cli.onboard',
  'cli.login',
  'cli.logout',
  // OpenSpec change events
  'openspec.open',
  'openspec.update',
  'change.open',
  'change.close',
  'change.commit',
  // Skills events
  'skill.installed',
  'skill.used',
  // Engram events
  'engram.setup',
  'engram.update',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(s: string): s is EventType {
  return (EVENT_TYPES as readonly string[]).includes(s);
}

// Work type for change.open — what kind of work is this?
export const WORK_TYPES = ['feature', 'migration', 'new-project', 'chore', 'fix', 'refactor', 'docs'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

// Per-type payload schemas (TypeScript-only — runtime validation is in the API route).
export type EventPayloadByType = {
  'cli.install': {
    os: 'darwin' | 'linux' | 'win32' | string;
    nodeVersion: string;
    toolsDetected: { claude?: boolean; opencode?: boolean; kiro?: boolean; codex?: boolean; antigravity?: boolean };
    fromVersion?: string;
  };
  'cli.update': {
    fromVersion: string;
    toVersion: string;
    success: boolean;
    durationMs?: number;
    error?: string;
  };
  'cli.doctor': {
    checksPassed: number;
    checksFailed: number;
    failures?: Array<{ name: string; message: string }>;
    durationMs?: number;
  };
  'cli.status': {
    perTool: Record<string, { installed: boolean; version?: string; configured: boolean }>;
    durationMs?: number;
  };
  'cli.mcp': {
    provider: string;
    configured: number;
    success: boolean;
  };
  'cli.onboard': {
    level: 'junior' | 'semi' | 'senior';
    durationMs: number;
    success: boolean;
  };
  'cli.login': {
    serverUrl: string;
    via: 'interactive' | 'token' | 'env';
  };
  'cli.logout': {};
  'openspec.open': {
    changeName: string;
    type?: 'feature' | 'fix' | 'chore' | 'refactor' | 'docs' | string;
  };
  'openspec.update': {
    changeName: string;
    artifact: 'proposal' | 'spec' | 'design' | 'tasks' | 'apply-progress' | 'verify-report' | string;
    op: 'created' | 'updated' | 'deleted';
  };
  'change.open': {
    changeName: string;
    workType: WorkType;
    title?: string;
    estimateMin?: number;
    estimateSource?: 'per-change' | 'admin-default' | 'bucket';
    estimateBucket?: 'small' | 'medium' | 'large' | 'xlarge';
  };
  'change.close': {
    changeName: string;
    workType: WorkType;
    totalCommits: number;
    durationMs: number;
    verdict?: 'pass' | 'fail' | 'blocked' | string;
    estimateMin?: number;
  };
  'change.commit': {
    changeName?: string; // may be null if commit is outside a change dir
    sha: string;
    shortSha: string;
    message: string;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    authorEmail?: string;
  };
  'skill.installed': {
    skillName: string;
    tool: 'claude' | 'opencode' | 'kiro' | 'codex' | 'antigravity' | string;
    version?: string;
    scope?: 'user' | 'project' | string;
  };
  'skill.used': {
    skillName: string;
    tool: 'claude' | 'opencode' | 'kiro' | 'codex' | 'antigravity' | string;
    context?: string;
  };
  'engram.setup': {
    engramVersion: string;
    mode: 'local' | 'cloud' | string;
  };
  'engram.update': {
    fromVersion: string;
    toVersion: string;
  };
};

export type EventPayload<T extends EventType = EventType> = EventPayloadByType[T];
