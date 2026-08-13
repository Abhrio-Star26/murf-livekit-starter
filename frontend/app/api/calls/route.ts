import { NextRequest, NextResponse } from 'next/server';

const ESCALATION_API = process.env.ESCALATION_API_URL || 'http://localhost:8001';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel') || '';
  const language = searchParams.get('language') || '';
  const outcome = searchParams.get('outcome') || '';
  const days = searchParams.get('days') || '';

  const params = new URLSearchParams();
  if (channel) params.set('channel', channel);
  if (language) params.set('language', language);
  if (outcome) params.set('outcome', outcome);
  if (days) params.set('days', days);

  const url = `${ESCALATION_API}/calls${params.toString() ? `?${params}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Calls API unreachable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const res = await fetch(`${ESCALATION_API}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Calls API unreachable' }, { status: 503 });
  }
}
