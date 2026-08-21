import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { SidebarToggle } from '@/components/layout/sidebar-toggle';
import { ThemePaletteProvider } from '@/components/layout/theme-palette-picker';
import { resolveSession } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('baseline_dashboard_session')?.value;

  const session = await resolveSession(sessionCookie);
  if (!session) {
    redirect('/login');
  }

  // Resolve locale from cookies
  const localeCookie = cookieStore.get('baseline_locale')?.value ?? '';
  const locale = localeCookie === 'es' ? 'es' : 'en';

  // Resolve current path from headers
  const headersList = await headers();
  const currentPath = headersList.get('x-invoke-path') ?? headersList.get('x-pathname') ?? '/dashboard';

  return (
    <ThemePaletteProvider>
      <div className="dashboard-shell">
        <Sidebar session={session} locale={locale} currentPath={currentPath} />
        <SidebarToggle />
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </ThemePaletteProvider>
  );
}
