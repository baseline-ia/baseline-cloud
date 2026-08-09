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

interface NavbarProps {
  user: DashboardSession;
  locale: string;
  currentPath: string;
}

const NAV_ICONS: Record<string, React.ReactElement> = {
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
};

const NAV_LINKS = [
  { href: '/dashboard', label: 'nav.overview', key: 'overview' },
  { href: '/dashboard/changes', label: 'nav.changes', key: 'changes' },
  { href: '/dashboard/skills', label: 'nav.skills', key: 'skills' },
  { href: '/dashboard/events', label: 'nav.events', key: 'events' },
  { href: '/dashboard/developers', label: 'nav.developers', key: 'developers' },
  { href: '/dashboard/activity', label: 'nav.activity', key: 'activity' },
];

const ADMIN_NAV_LINKS = [
  { href: '/dashboard/admin/tokens', label: 'nav.tokens', key: 'admin-tokens' },
  { href: '/dashboard/admin/users', label: 'nav.users', key: 'admin-users' },
  { href: '/dashboard/admin/settings', label: 'nav.settings', key: 'admin-settings' },
  { href: '/dashboard/admin/projects', label: 'nav.projects', key: 'admin-projects' },
];

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
    'nav.logout': 'Logout',
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
    'nav.logout': 'Cerrar sesión',
  },
};

function navLabel(locale: string, key: string): string {
  return NAV_LABELS[locale]?.[key] ?? NAV_LABELS.en[key] ?? key;
}

function isActive(href: string, currentPath: string): boolean {
  if (href === '/dashboard') return currentPath === '/dashboard' || currentPath === '/dashboard/';
  return currentPath.startsWith(href);
}

export function Navbar({ user, locale, currentPath }: NavbarProps) {
  const otherLocale = locale === 'es' ? 'en' : 'es';
  const switchLocalePath = `/dashboard/set-locale?locale=${otherLocale}&next=${encodeURIComponent(currentPath)}`;
  const avatarInitial = (user.username ?? '?').charAt(0).toUpperCase();

  return (
    <nav className="navbar">
      <Link href="/dashboard" className="navbar-brand">
        <span className="logo">b</span>
        baseline-cloud
      </Link>

      <div className="navbar-links">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            className={isActive(link.href, currentPath) ? 'active' : ''}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {NAV_ICONS[link.key]}
              {navLabel(locale, link.label)}
            </span>
          </Link>
        ))}
        {user.role === 'admin' &&
          ADMIN_NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={isActive(link.href, currentPath) ? 'active' : ''}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {NAV_ICONS[link.key]}
                {navLabel(locale, link.label)}
              </span>
            </Link>
          ))}
      </div>

      <div className="navbar-user">
        <div className="avatar">{avatarInitial}</div>
        <span className="username">{user.username}</span>
        <a
          href={switchLocalePath}
          className="theme-toggle"
          title={otherLocale === 'es' ? 'Español' : 'English'}
          style={{
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            padding: '0 0.5rem',
            width: 'auto',
            height: '32px',
          }}
        >
          {locale.toUpperCase()}
        </a>
        <ThemeToggle />
        <form method="post" action="/api/auth/logout">
          <button type="submit" className="btn-logout">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <LogOut size={14} />
              {navLabel(locale, 'nav.logout')}
            </span>
          </button>
        </form>
      </div>
    </nav>
  );
}
