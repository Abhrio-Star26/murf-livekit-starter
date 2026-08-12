import { NextRequest, NextResponse } from 'next/server';

const ESCALATION_API = process.env.ESCALATION_API_URL || 'http://localhost:8001';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const urgency = searchParams.get('urgency') || '';

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (urgency) params.set('urgency', urgency);

  const url = `${ESCALATION_API}/escalations${params.toString() ? `?${params}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Escalation API unreachable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const res = await fetch(`${ESCALATION_API}/escalations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Escalation API unreachable' }, { status: 503 });
  }
}
