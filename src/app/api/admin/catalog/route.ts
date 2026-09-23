import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

function isAdminAuthorized(): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token, secret);
}

async function callAdminEdge(body: Record<string, unknown>) {
  const baseUrl = process.env.SUPABASE_URL;
  const adminToken = process.env.CMPICK_ADMIN_API_TOKEN;
  if (!baseUrl || !adminToken) {
    return { status: 503, body: { error: 'ADMIN_DB_CONFIG_MISSING' } };
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/cmpick-admin-api`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'INVALID_UPSTREAM_RESPONSE' };
    }
    return { status: response.status, body: data };
  } catch {
    return { status: 503, body: { error: 'ADMIN_DB_UNAVAILABLE' } };
  }
}

export async function GET() {
  if (!isAdminAuthorized()) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const result = await callAdminEdge({ action: 'pending_state' });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  if (!isAdminAuthorized()) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const action = String(body.action ?? '');
  if (action !== 'save_product' && action !== 'skip_pending') {
    return NextResponse.json({ error: 'ACTION_FORBIDDEN' }, { status: 403 });
  }

  const result = await callAdminEdge(body);
  return NextResponse.json(result.body, { status: result.status });
}
