import { NextRequest, NextResponse } from 'next/server';

const ESCALATION_API = process.env.ESCALATION_API_URL || 'http://localhost:8001';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get('days') || '';

  const params = new URLSearchParams();
  if (days) params.set('days', days);

  const url = `${ESCALATION_API}/analytics${params.toString() ? `?${params}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Analytics API unreachable' }, { status: 503 });
  }
}
