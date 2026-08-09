import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
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
    <div>
      <Navbar user={session} locale={locale} currentPath={currentPath} />
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  );
}
