import Link from 'next/link';
import {
  LayoutDashboard,
  GitMerge,
  Zap,
  Radio,
  Users,
  Activity,
  KeyRound,
  UserCog,
  Settings,
  FolderKanban,
  LogOut,
} from 'lucide-react';
import type { DashboardSession } from '@/lib/auth';
import { ThemeToggle } from './theme-toggle';
import { isActive } from '@/lib/nav-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarProps {
  session: DashboardSession;
  locale: 'en' | 'es';
  currentPath: string;
}

interface NavLink {
  href: string;
  label: string;
  key: string;
}

interface NavGroup {
  id: 'analytics' | 'admin';
  headerKey: string;
  links: NavLink[];
}

// ---------------------------------------------------------------------------
// Navigation data
// ---------------------------------------------------------------------------

const NAV_ICONS: Readonly<Record<string, React.ReactElement>> = {
  overview: <LayoutDashboard size={15} />,
  changes: <GitMerge size={15} />,
  skills: <Zap size={15} />,
  events: <Radio size={15} />,
  developers: <Users size={15} />,
  activity: <Activity size={15} />,
  'admin-tokens': <KeyRound size={15} />,
  'admin-users': <UserCog size={15} />,
  'admin-settings': <Settings size={15} />,
  'admin-projects': <FolderKanban size={15} />,
  'admin-skills': <Zap size={15} />,
};

const NAV_LABELS: Record<string, Record<string, string>> = {
  en: {
    'nav.overview': 'Overview',
    'nav.changes': 'Changes & ROI',
    'nav.skills': 'Skills',
    'nav.events': 'Events',
    'nav.developers': 'Developers',
    'nav.activity': 'Activity',
    'nav.tokens': 'Tokens',
    'nav.users': 'Users',
    'nav.settings': 'Settings',
    'nav.projects': 'Projects',
    'nav.skills-admin': 'Skills',
    'nav.logout': 'Logout',
    'nav.group.analytics': 'Analytics',
    'nav.group.admin': 'Admin',
  },
  es: {
    'nav.overview': 'Resumen',
    'nav.changes': 'Cambios & ROI',
    'nav.skills': 'Habilidades',
    'nav.events': 'Eventos',
    'nav.developers': 'Desarrolladores',
    'nav.activity': 'Actividad',
    'nav.tokens': 'Tokens',
    'nav.users': 'Usuarios',
    'nav.settings': 'Configuración',
    'nav.projects': 'Proyectos',
    'nav.skills-admin': 'Habilidades',
    'nav.logout': 'Cerrar sesión',
    'nav.group.analytics': 'Analytics',
    'nav.group.admin': 'Admin',
  },
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'analytics',
    headerKey: 'nav.group.analytics',
    links: [
      { href: '/dashboard', label: 'nav.overview', key: 'overview' },
      { href: '/dashboard/changes', label: 'nav.changes', key: 'changes' },
      { href: '/dashboard/skills', label: 'nav.skills', key: 'skills' },
      { href: '/dashboard/events', label: 'nav.events', key: 'events' },
      { href: '/dashboard/developers', label: 'nav.developers', key: 'developers' },
      { href: '/dashboard/activity', label: 'nav.activity', key: 'activity' },
    ],
  },
  {
    id: 'admin',
    headerKey: 'nav.group.admin',
    links: [
      { href: '/dashboard/admin/tokens', label: 'nav.tokens', key: 'admin-tokens' },
      { href: '/dashboard/admin/users', label: 'nav.users', key: 'admin-users' },
      { href: '/dashboard/admin/settings', label: 'nav.settings', key: 'admin-settings' },
      { href: '/dashboard/admin/projects', label: 'nav.projects', key: 'admin-projects' },
      { href: '/dashboard/admin/skills', label: 'nav.skills-admin', key: 'admin-skills' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function navLabel(locale: string, key: string): string {
  return NAV_LABELS[locale]?.[key] ?? NAV_LABELS.en[key] ?? key;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar({ session, locale, currentPath }: SidebarProps) {
  const otherLocale = locale === 'es' ? 'en' : 'es';
  const switchLocalePath = `/dashboard/set-locale?locale=${otherLocale}&next=${encodeURIComponent(currentPath)}`;

  const visibleGroups = NAV_GROUPS.filter(
    (group) => group.id !== 'admin' || session.role === 'admin',
  );

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <Link href="/dashboard">
          <span className="logo">b</span>
          baseline-cloud
        </Link>
      </div>

      {/* Navigation groups */}
      <nav>
        {visibleGroups.map((group) => (
          <div key={group.id} className="sidebar-group">
            <div className="sidebar-group-header">
              {navLabel(locale, group.headerKey)}
            </div>
            {group.links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={`sidebar-link${isActive(link.href, currentPath) ? ' active' : ''}`}
              >
                {NAV_ICONS[link.key]}
                {navLabel(locale, link.label)}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <a
          href={switchLocalePath}
          title={otherLocale === 'es' ? 'Español' : 'English'}
          className="sidebar-link"
        >
          {locale.toUpperCase()}
        </a>
        <ThemeToggle />
        <form method="post" action="/api/auth/logout">
          <button type="submit" className="sidebar-link">
            <LogOut size={14} />
            {navLabel(locale, 'nav.logout')}
          </button>
        </form>
      </div>
    </aside>
  );
}
