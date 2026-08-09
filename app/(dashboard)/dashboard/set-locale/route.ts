import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locale = searchParams.get('locale');
  const next = searchParams.get('next') ?? '/dashboard';

  const validLocale = locale === 'es' || locale === 'en' ? locale : 'en';
  const redirectTo = next.startsWith('/') ? next : '/dashboard';

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set('baseline_locale', validLocale, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
