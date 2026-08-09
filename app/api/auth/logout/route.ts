import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSession, destroySession } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('baseline_dashboard_session')?.value;

  if (sessionCookie) {
    const session = await resolveSession(sessionCookie);
    if (session) {
      await destroySession(session.id, session.userId);
    }
    cookieStore.delete('baseline_dashboard_session');
  }

  redirect('/login');
}
