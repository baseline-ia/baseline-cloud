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
import { SidebarCollapseToggle } from './sidebar-collapse-toggle';
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

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
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
      {/* Brand + collapse toggle */}
      <div className="sidebar-brand">
        <Link href="/dashboard">
          <span className="logo">b</span>
          <span className="sidebar-brand-text">baseline-cloud</span>
        </Link>
        <SidebarCollapseToggle />
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
                title={navLabel(locale, link.label)}
              >
                {NAV_ICONS[link.key]}
                <span className="sidebar-link-text">{navLabel(locale, link.label)}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer with user avatar */}
      <div className="sidebar-footer">
        {/* Row 1: Avatar + user info | Logout button */}
        <div className="sidebar-footer-row">
          <div className="sidebar-user">
            <div className="sidebar-avatar" title={session.username}>
              {getInitials(session.username)}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-username">{session.username}</span>
              <span className="sidebar-role">{session.role}</span>
            </div>
          </div>
          <form method="post" action="/api/auth/logout" className="sidebar-logout-form">
            <button type="submit" className="sidebar-link" title={navLabel(locale, 'nav.logout')}>
              <LogOut size={14} />
            </button>
          </form>
        </div>

        {/* Row 2: Language + Theme */}
        <div className="sidebar-footer-actions">
          <a
            href={switchLocalePath}
            title={otherLocale === 'es' ? 'Español' : 'English'}
            className="sidebar-link"
          >
            {locale.toUpperCase()}
          </a>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
