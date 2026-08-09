import { checkDbHealth } from '@/lib/db/client';

export async function GET() {
  const dbOk = await checkDbHealth();
  if (!dbOk) {
    return Response.json({ status: 'error', db: 'unreachable' }, { status: 503 });
  }
  return Response.json({ status: 'ok', service: 'baseline-cloud', db: 'ok' });
}
