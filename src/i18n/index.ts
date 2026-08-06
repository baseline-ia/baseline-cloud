/**
 * i18n — internationalization for the dashboard.
 *
 * Two locales: 'en' (English) and 'es' (Spanish).
 *
 * Resolution order in `resolveLocale`:
 *   1. `?lang=es` query param (sets the cookie on first hit)
 *   2. `baseline_locale` cookie
 *   3. `Accept-Language` header
 *   4. Default: 'en'
 *
 * Templates receive a `t(key)` helper that translates a dotted
 * path like `t('nav.overview')`. Missing keys fall back to the key
 * itself (so untranslated strings are obvious in the UI, not
 * silently empty).
 */
import type { FastifyRequest, FastifyReply } from 'fastify';

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

type Dict = { [key: string]: string | Dict };

const en: Dict = {
  nav: {
    overview: 'Overview',
    changes: 'Changes & ROI',
    skills: 'Skills',
    events: 'Events',
    developers: 'Developers',
    activity: 'Activity',
    tokens: 'Tokens',
    users: 'Users',
    settings: 'Settings',
    logout: 'Logout',
    back_to: '← Back',
  },
  page: {
    overview: {
      title: 'Overview',
      subtitle: 'Time and projects across the team — not raw event counts',
    },
    changes: {
      title: 'Changes & ROI',
      subtitle: 'Per-change time tracking vs. estimated time without baseline + AI',
      all_changes: 'All changes',
      no_changes: 'No changes yet.',
      no_changes_help: 'Have your devs run baseline openspec new <name> --type feature.',
    },
    skills: {
      title: 'Skills adoption',
      subtitle: 'Skills installed per dev across all tools',
      no_skills: 'No skill.installed events yet.',
      no_skills_help: 'Skills tracking fires automatically when devs run baseline install.',
    },
    events: {
      title: 'Events',
      subtitle: 'All events sent by the CLI. Click a username to see per-developer detail.',
      no_events: 'No events yet.',
    },
    developers: {
      title: 'Developers',
      subtitle: 'Per-developer activity across the team',
      no_developers: 'No developers have sent events yet.',
      no_developers_help: 'Have them run baseline login on their machines.',
      all_developers: 'All developers',
      activity_30d: 'Activity by developer (last 30 days)',
    },
    activity: {
      title: 'Activity',
      subtitle: 'Live feed (auto-refreshes every 5 seconds).',
    },
    developer_detail: {
      stats_50: 'Recent events (last 50)',
      unique_types: 'Unique event types',
      projects_touched: 'Projects touched',
      recent_events: 'Recent events',
      back: 'Back to all developers',
    },
    change_detail: {
      work_type: 'Work type',
      actual_time: 'Actual time',
      baseline_no: 'Baseline (no baseline)',
      time_saved: 'Time saved',
      commits: 'Commits',
      timeline: 'Timeline',
      timeline_sub: 'Open → commits → close',
      opened: 'Change opened',
      still_open: 'Still open',
      still_open_help: 'Run baseline openspec close <name> to archive.',
    },
    admin_tokens: {
      title: 'Admin · Tokens',
      subtitle: 'All bearer tokens. Revoke to invalidate. The raw token is shown ONCE on issue.',
      issue_new: 'Issue new token',
      all_tokens: 'All tokens',
      name: 'Name',
      your_password: 'Your password',
      issue: 'Issue',
    },
    admin_users: {
      title: 'Admin · Users',
      subtitle: 'All registered users',
      create_new: 'Create new user',
      all_users: 'All users',
    },
    admin_settings: {
      title: 'Admin · Settings',
      subtitle: 'Workspace-level configuration',
      time_baselines: 'Time baselines (per work type)',
      time_baselines_sub: '"Estimated time WITHOUT baseline" used for ROI calculations',
      info: 'How this works',
      info_body: 'For each closed change, the dashboard compares actual time (open→close) against this baseline. The "ROI" is the percentage of baseline time saved by using baseline. If a dev provides a per-change estimate (via --estimate), that estimate overrides this default for that specific change.',
      save: 'Save baselines',
      reset: 'Reset',
    },
    token_issued: {
      title: '✓ Token issued',
      subtitle: 'Copy this token now. It will not be shown again.',
      raw_label: 'Raw bearer token',
      use_label: 'Use it on a dev machine',
      env_help: 'Or set the env vars: BASELINE_CLOUD_URL and BASELINE_CLOUD_TOKEN.',
    },
  },
  stat: {
    active_projects_7d: 'Active projects (7d)',
    time_this_week: 'Time this week',
    time_saved_total: 'Time saved (total)',
    roi: 'ROI vs. baseline',
    total_changes: 'Total changes',
    active_devs_7d: 'Active devs (7d)',
    total_devs: 'Total devs',
    commits: 'Commits across changes',
  },
  chart: {
    time_per_project: 'Time per project',
    time_per_project_sub: 'Hours spent on closed changes, last 30 days',
    time_by_developer: 'Time by developer',
    time_by_developer_sub: 'Hours spent on changes, last 30 days',
    time_saved_per_change: 'Time saved per change',
    time_saved_per_change_sub: 'Hours saved vs. the per-change estimate',
    roi_by_work_type: 'ROI by work type',
    roi_by_work_type_sub: 'Total hours saved per work type',
    time_by_work_type: 'Time by work type',
    time_by_work_type_sub: 'Hours spent per work type, last 30 days',
    events_per_day: 'Event volume',
    events_per_day_sub: 'Events per day, last 30 days',
    by_event_type: 'By event type',
    by_event_type_sub: 'Last 7 days',
    top_developers: 'Top developers',
    top_developers_sub: 'Event count, last 30 days',
    recent_activity: 'Recent activity',
    recent_activity_sub: 'Last 8 events across all devs',
    skills_by_tool: 'By tool',
    skills_by_tool_sub: 'Skill installations per tool',
    all_skills: 'All skills',
  },
  empty: {
    no_changes_yet: 'No closed changes yet.',
    no_events: 'No events yet.',
    no_data: 'No data.',
  },
  badge: {
    open: '○ open',
    closed: '✓ closed',
    active: '✓ active',
    revoked: '✗ revoked',
    admin: 'admin',
    member: 'member',
    enabled: '● enabled',
    disabled: '● disabled',
    plan: 'plan',
    default: 'default',
    bucket: 'bucket',
    per_change: 'per-change',
    source: 'source',
    source_default: 'default',
    success: 'pass',
    fail: 'fail',
  },
  button: {
    save: 'Save',
    cancel: 'Cancel',
    reset: 'Reset',
    revoke: 'Revoke',
    create: 'Create',
    issue: 'Issue',
    signin: 'Sign in',
    logout: 'Logout',
    cancel_link: 'Cancel',
  },
  form: {
    username: 'Username',
    password: 'Password',
    email: 'Email',
    role: 'Role',
    role_admin: 'admin',
    role_member: 'member',
    new_token_name: 'Name',
    new_token_help: 'Your password (to confirm)',
    signup_help_title: 'New here? Sign up via the API:',
  },
  login: {
    title: 'baseline-cloud',
    subtitle: 'Self-hosted telemetry dashboard for the baseline CLI',
    signup_help: 'New here? Sign up via the API:',
    required_fields: 'username + password required',
    invalid_credentials: 'Invalid username or password',
  },
  common: {
    hours: 'h',
    minutes: 'm',
    percent: '%',
    and: 'and',
  },
  language: {
    en: 'English',
    es: 'Español',
  },
  empty_state: {
    no_events_title: 'No events yet.',
    no_events_help: 'Have your devs run baseline login on their machines.',
    no_changes_title: 'No changes yet.',
    no_changes_help_long: 'No changes tracked yet. Have your devs run baseline openspec new <name> --type feature.',
    no_commits: 'No commits tracked yet.',
    no_activity: 'No activity yet.',
  },
  time: {
    ago: 'ago',
    hours: 'hours',
    minutes: 'minutes',
  },
};

const es: Dict = {
  nav: {
    overview: 'Resumen',
    changes: 'Cambios & ROI',
    skills: 'Habilidades',
    events: 'Eventos',
    developers: 'Desarrolladores',
    activity: 'Actividad',
    tokens: 'Tokens',
    users: 'Usuarios',
    settings: 'Configuración',
    logout: 'Cerrar sesión',
    back_to: '← Volver',
  },
  page: {
    overview: {
      title: 'Resumen',
      subtitle: 'Tiempo y proyectos del equipo — no conteo de eventos',
    },
    changes: {
      title: 'Cambios & ROI',
      subtitle: 'Tracking de tiempo por change vs. estimación sin baseline + IA',
      all_changes: 'Todos los cambios',
      no_changes: 'Aún no hay cambios.',
      no_changes_help: 'Pedile a los devs que corran baseline openspec new <nombre> --type feature.',
    },
    skills: {
      title: 'Adopción de habilidades',
      subtitle: 'Habilidades instaladas por dev en todas las tools',
      no_skills: 'Aún no hay eventos skill.installed.',
      no_skills_help: 'El tracking se dispara automáticamente cuando los devs corren baseline install.',
    },
    events: {
      title: 'Eventos',
      subtitle: 'Todos los eventos enviados por la CLI. Hacé click en un username para ver el detalle por dev.',
      no_events: 'Aún no hay eventos.',
    },
    developers: {
      title: 'Desarrolladores',
      subtitle: 'Actividad por dev en el equipo',
      no_developers: 'Ningún dev ha enviado eventos aún.',
      no_developers_help: 'Que corran baseline login en sus máquinas.',
      all_developers: 'Todos los developers',
      activity_30d: 'Actividad por developer (últimos 30 días)',
    },
    activity: {
      title: 'Actividad',
      subtitle: 'Feed en vivo (auto-refresh cada 5 segundos).',
    },
    developer_detail: {
      stats_50: 'Eventos recientes (últimos 50)',
      unique_types: 'Tipos de evento únicos',
      projects_touched: 'Proyectos tocados',
      recent_events: 'Eventos recientes',
      back: 'Volver a todos los developers',
    },
    change_detail: {
      work_type: 'Tipo de trabajo',
      actual_time: 'Tiempo real',
      baseline_no: 'Baseline (sin baseline)',
      time_saved: 'Tiempo ahorrado',
      commits: 'Commits',
      timeline: 'Timeline',
      timeline_sub: 'Open → commits → close',
      opened: 'Change abierto',
      still_open: 'Sigue abierto',
      still_open_help: 'Corré baseline openspec close <nombre> para archivar.',
    },
    admin_tokens: {
      title: 'Admin · Tokens',
      subtitle: 'Todos los bearer tokens. Revocá para invalidar. El token raw se muestra UNA vez al emitirlo.',
      issue_new: 'Emitir nuevo token',
      all_tokens: 'Todos los tokens',
      name: 'Nombre',
      your_password: 'Tu password',
      issue: 'Emitir',
    },
    admin_users: {
      title: 'Admin · Usuarios',
      subtitle: 'Todos los usuarios registrados',
      create_new: 'Crear nuevo usuario',
      all_users: 'Todos los usuarios',
    },
    admin_settings: {
      title: 'Admin · Configuración',
      subtitle: 'Configuración a nivel workspace',
      time_baselines: 'Baselines de tiempo (por tipo de trabajo)',
      time_baselines_sub: '"Tiempo estimado SIN baseline" usado para los cálculos de ROI',
      info: 'Cómo funciona',
      info_body: 'Por cada change cerrado, el dashboard compara el tiempo real (open→close) contra este baseline. El "ROI" es el porcentaje del baseline que se ahorró usando baseline. Si un dev pasa un estimate per-change (con --estimate), ese estimate override el default para ese change específico.',
      save: 'Guardar baselines',
      reset: 'Resetear',
    },
    token_issued: {
      title: '✓ Token emitido',
      subtitle: 'Copiá este token ahora. No se va a mostrar de nuevo.',
      raw_label: 'Bearer token raw',
      use_label: 'Usalo en la máquina de un dev',
      env_help: 'O seteá las env vars: BASELINE_CLOUD_URL y BASELINE_CLOUD_TOKEN.',
    },
  },
  stat: {
    active_projects_7d: 'Proyectos activos (7d)',
    time_this_week: 'Tiempo esta semana',
    time_saved_total: 'Tiempo ahorrado (total)',
    roi: 'ROI vs. baseline',
    total_changes: 'Total de cambios',
    active_devs_7d: 'Devs activos (7d)',
    total_devs: 'Total de devs',
    commits: 'Commits en cambios',
  },
  chart: {
    time_per_project: 'Tiempo por proyecto',
    time_per_project_sub: 'Horas en cambios cerrados, últimos 30 días',
    time_by_developer: 'Tiempo por developer',
    time_by_developer_sub: 'Horas en cambios, últimos 30 días',
    time_saved_per_change: 'Tiempo ahorrado por change',
    time_saved_per_change_sub: 'Horas ahorradas vs. el estimate per-change',
    roi_by_work_type: 'ROI por tipo de trabajo',
    roi_by_work_type_sub: 'Total de horas ahorradas por tipo de trabajo',
    time_by_work_type: 'Tiempo por tipo de trabajo',
    time_by_work_type_sub: 'Horas por tipo de trabajo, últimos 30 días',
    events_per_day: 'Volumen de eventos',
    events_per_day_sub: 'Eventos por día, últimos 30 días',
    by_event_type: 'Por tipo de evento',
    by_event_type_sub: 'Últimos 7 días',
    top_developers: 'Top developers',
    top_developers_sub: 'Conteo de eventos, últimos 30 días',
    recent_activity: 'Actividad reciente',
    recent_activity_sub: 'Últimos 8 eventos de todos los devs',
    skills_by_tool: 'Por tool',
    skills_by_tool_sub: 'Instalaciones de skills por tool',
    all_skills: 'Todas las skills',
  },
  empty: {
    no_changes_yet: 'Aún no hay cambios cerrados.',
    no_events: 'Aún no hay eventos.',
    no_data: 'Sin datos.',
  },
  badge: {
    open: '○ abierto',
    closed: '✓ cerrado',
    active: '✓ activo',
    revoked: '✗ revocado',
    admin: 'admin',
    member: 'miembro',
    enabled: '● habilitado',
    disabled: '● deshabilitado',
    plan: 'plan',
    default: 'default',
    bucket: 'bucket',
    per_change: 'per-change',
    source: 'origen',
    source_default: 'default',
    success: 'pass',
    fail: 'fail',
  },
  button: {
    save: 'Guardar',
    cancel: 'Cancelar',
    reset: 'Resetear',
    revoke: 'Revocar',
    create: 'Crear',
    issue: 'Emitir',
    signin: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    cancel_link: 'Cancelar',
  },
  form: {
    username: 'Usuario',
    password: 'Contraseña',
    email: 'Email',
    role: 'Rol',
    role_admin: 'admin',
    role_member: 'miembro',
    new_token_name: 'Nombre',
    new_token_help: 'Tu contraseña (para confirmar)',
    signup_help_title: '¿Nuevo acá? Registrate vía la API:',
  },
  login: {
    title: 'baseline-cloud',
    subtitle: 'Dashboard de telemetría self-hosted para la CLI de baseline',
    signup_help: '¿Nuevo acá? Registrate vía la API:',
    required_fields: 'usuario + contraseña requeridos',
    invalid_credentials: 'Usuario o contraseña inválidos',
  },
  common: {
    hours: 'h',
    minutes: 'm',
    percent: '%',
    and: 'y',
  },
  language: {
    en: 'English',
    es: 'Español',
  },
  empty_state: {
    no_events_title: 'Aún no hay eventos.',
    no_events_help: 'Que los devs corran baseline login en sus máquinas.',
    no_changes_title: 'Aún no hay cambios.',
    no_changes_help_long: 'No hay cambios tracked aún. Que los devs corran baseline openspec new <nombre> --type feature.',
    no_commits: 'Aún no hay commits tracked.',
    no_activity: 'Aún no hay actividad.',
  },
  time: {
    ago: 'hace',
    hours: 'horas',
    minutes: 'minutos',
  },
};

const DICTIONARIES: Record<Locale, Dict> = { en, es };

/**
 * Resolve a dotted key from a dictionary. Returns the key itself if not found.
 * Example: resolveDict(en, 'nav.overview') → 'Overview'
 */
function resolveDict(dict: Dict, key: string): string {
  const parts = key.split('.');
  let cur: string | Dict = dict;
  for (const p of parts) {
    if (typeof cur === 'object' && cur !== null && p in cur) {
      cur = cur[p] as string | Dict;
    } else {
      return key; // fallback: return the key so it's visible in the UI
    }
  }
  return typeof cur === 'string' ? cur : key;
}

/**
 * Translate a key for the given locale. Falls back to English, then to the key.
 */
export function t(locale: Locale, key: string): string {
  const translated = resolveDict(DICTIONARIES[locale], key);
  if (translated !== key) return translated;
  // Fallback to English
  if (locale !== 'en') {
    const en = resolveDict(DICTIONARIES.en, key);
    if (en !== key) return en;
  }
  return key;
}

/**
 * Get the user's preferred locale from a Fastify request.
 * Order: query param > cookie > Accept-Language > default.
 */
export function resolveLocale(req: {
  query?: unknown;
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | unknown>;
}): Locale {
  const fromQuery = String((req.query as Record<string, unknown> | undefined)?.lang ?? '').toLowerCase();
  if (fromQuery === 'es' || fromQuery === 'en') return fromQuery as Locale;
  const fromCookie = String(req.cookies?.['baseline_locale'] ?? '').toLowerCase();
  if (fromCookie === 'es' || fromCookie === 'en') return fromCookie as Locale;
  const acceptLang = String(req.headers?.['accept-language'] ?? '').toLowerCase();
  if (acceptLang.startsWith('es')) return 'es';
  return DEFAULT_LOCALE;
}

/**
 * Fastify hook-style helper to attach the locale + t helper to a request.
 * Use as a preHandler hook.
 */
export function i18nHook(
  req: {
    query?: unknown;
    cookies?: Record<string, string | undefined>;
    headers?: Record<string, string | unknown>;
  },
  _reply: unknown,
) {
  const locale = resolveLocale(req);
  (req as Record<string, unknown>).locale = locale;
  (req as Record<string, unknown>).t = (key: string) => t(locale, key);
}

export type { Dict };
