'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession } from '@/lib/auth';

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return { error: 'username + password required' };
  }

  const { username, password, next } = parsed.data;

  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const user = rows[0];

  if (!user || !user.enabled || !(await verifyPassword(password, user.passwordHash))) {
    return { error: 'Invalid username or password' };
  }

  const { cookieValue } = await createSession(user.id);

  // Update last login timestamp
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const cookieStore = await cookies();
  cookieStore.set('baseline_dashboard_session', cookieValue, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60, // 8h
  });

  const redirectTo = next && next.startsWith('/') ? next : '/dashboard';
  redirect(redirectTo);
}
