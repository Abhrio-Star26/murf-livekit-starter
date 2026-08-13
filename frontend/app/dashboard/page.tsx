'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { JanaLogo } from '@/components/agents-ui/jana-logo';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CallLog {
  id: string;
  room_name: string;
  user_id: string;
  caller_name: string;
  channel: 'browser' | 'sip';
  language: string;
  outcome: 'success' | 'failed';
  failure_type: string;
  track_outcome: string;
  scheme_checked: string;
  latency_ms: number;
  duration_seconds: number;
  created_at: string;
}

interface AnalyticsData {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  success_rate: number;
  latency: {
    avg_ms: number;
    min_ms: number;
    max_ms: number;
  };
  failure_types: Record<string, number>;
  track_outcomes: Record<string, number>;
  channels: Record<string, number>;
  calls: CallLog[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FAILURE_LABELS: Record<string, { label: string; desc: string }> = {
  user_declined:   { label: 'User Declined Consent', desc: 'Caller opted out of saving info/escalation' },
  incomplete_task: { label: 'Incomplete Task', desc: 'Call ended before completing check or enquiry' },
  tool_failure:    { label: 'Tool Failure', desc: 'Database or scheme evaluation exception' },
  api_error:       { label: 'API Error', desc: 'External API or LLM service failure' },
  no_response:     { label: 'No Response', desc: 'Silence / turn timeout from caller' },
  user_hangup:     { label: 'User Hangup', desc: 'Caller ended call early' },
};

const TRACK_OUTCOME_LABELS: Record<string, string> = {
  eligibility_check_completed: 'Eligibility Check Completed (Financial Track)',
  document_checklist_received: 'Document List Delivered',
  escalation_created: 'Human Escalation Ticket Created',
  deadline_alert_delivered: 'Proactive Scheme Deadline Alert Sent',
  none: 'General Literacy / Incomplete',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return `${Math.max(1, Math.round(diff))}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtext,
  color = '#e2e8f0',
  badge,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  badge?: string;
}) {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      border: '1px solid rgba(20, 184, 166, 0.25)',
      borderRadius: '16px',
      padding: '20px 24px',
      flex: '1 1 200px',
      minWidth: '200px',
      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        {badge && (
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
            background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf', border: '1px solid rgba(20, 184, 166, 0.3)',
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
          {subtext}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ─────────────────────────────────────────────────────

export default function CallAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [daysFilter, setDaysFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [langFilter, setLangFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async () => {
    try {
      const analyticsParams = new URLSearchParams();
      if (daysFilter) analyticsParams.set('days', daysFilter);

      const callsParams = new URLSearchParams();
      if (daysFilter) callsParams.set('days', daysFilter);
      if (channelFilter) callsParams.set('channel', channelFilter);
      if (langFilter) callsParams.set('language', langFilter);
      if (outcomeFilter) callsParams.set('outcome', outcomeFilter);

      const [resAnalytics, resCalls] = await Promise.all([
        fetch(`/api/analytics?${analyticsParams.toString()}`, { cache: 'no-store' }),
        fetch(`/api/calls?${callsParams.toString()}`, { cache: 'no-store' }),
      ]);

      if (!resAnalytics.ok || !resCalls.ok) {
        throw new Error('API server returned error');
      }

      const dataAnalytics: AnalyticsData = await resAnalytics.json();
      const dataCalls: CallLog[] = await resCalls.json();

      setAnalytics(dataAnalytics);
      setCalls(dataCalls);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Could not connect to Analytics API. Ensure backend FastAPI server is running on port 8001.');
    } finally {
      setLoading(false);
    }
  }, [daysFilter, channelFilter, langFilter, outcomeFilter]);

  // Live Auto-Refresh every 5 seconds as calls end
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)',
      fontFamily: "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#f8fafc',
    }}>
      {/* Header Bar matching Jana Sakhyam Design */}
      <header style={{
        background: 'rgba(2, 6, 23, 0.85)',
        borderBottom: '1px solid rgba(20, 184, 166, 0.3)',
        padding: '18px 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <JanaLogo size={36} />
          <div>
            <h1 style={{
              margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em',
              background: 'linear-gradient(90deg, #99f6e4 0%, #a7f3d0 50%, #fef08a 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              Jana Sakhyam (जनः सख्यम्) — Call Analytics
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#5eead4' }}>
              Financial Services Voice Agent · Real-Time Call Outcomes & Telephony Metrics
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 10px #10b981', display: 'inline-block',
            }} />
            Live Auto-Refresh (5s) · Updated {lastRefresh.toLocaleTimeString('en-IN')}
          </div>

          <Link href="/escalations" style={{
            background: 'rgba(30, 41, 59, 0.8)',
            color: '#cbd5e1',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}>
            🛡️ Escalations Dashboard
          </Link>

          <Link href="/" style={{
            background: 'rgba(20, 184, 166, 0.15)',
            color: '#2dd4bf',
            border: '1px solid rgba(20, 184, 166, 0.4)',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}>
            🎙️ Launch Voice Agent
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '28px',
            color: '#fca5a5',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Filters Row */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(30, 41, 59, 0.8)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>Filter Calls:</span>

            {/* Date Filter */}
            <select
              id="filter-date"
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              style={{
                background: '#0f172a', color: '#f8fafc', border: '1px solid rgba(51, 65, 85, 0.8)',
                borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <option value="">📅 All Time</option>
              <option value="1">Today (24h)</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
            </select>

            {/* Channel Filter */}
            <select
              id="filter-channel"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              style={{
                background: '#0f172a', color: '#f8fafc', border: '1px solid rgba(51, 65, 85, 0.8)',
                borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <option value="">📡 All Channels (Browser & SIP)</option>
              <option value="browser">💻 Web Browser (LiveKit WebRTC)</option>
              <option value="sip">📞 Telephony (Linphone SIP Trunk)</option>
            </select>

            {/* Language Filter */}
            <select
              id="filter-lang"
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              style={{
                background: '#0f172a', color: '#f8fafc', border: '1px solid rgba(51, 65, 85, 0.8)',
                borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <option value="">🌐 All Languages</option>
              <option value="hi-IN">🇮🇳 Hindi (हिंदी)</option>
              <option value="en-IN">🇬🇧 Indian English</option>
            </select>

            {/* Outcome Filter */}
            <select
              id="filter-outcome"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              style={{
                background: '#0f172a', color: '#f8fafc', border: '1px solid rgba(51, 65, 85, 0.8)',
                borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <option value="">🎯 All Outcomes</option>
              <option value="success">✅ Successful Calls</option>
              <option value="failed">❌ Failed / Incomplete</option>
            </select>
          </div>

          <button
            id="btn-manual-refresh"
            onClick={() => { setLoading(true); fetchDashboardData(); }}
            style={{
              background: 'rgba(20, 184, 166, 0.1)', color: '#2dd4bf',
              border: '1px solid rgba(20, 184, 166, 0.3)', borderRadius: '8px',
              padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            ↻ Refresh Now
          </button>
        </div>

        {/* ─── The Three Numbers & Top Cards ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
          <StatCard
            label="Total Calls"
            value={analytics ? analytics.total_calls : '0'}
            subtext="Actual WebRTC & SIP sessions recorded"
            color="#38bdf8"
          />
          <StatCard
            label="Successful Calls"
            value={analytics ? analytics.successful_calls : '0'}
            subtext="Completed eligibility or doc checklist"
            color="#34d399"
            badge="Target Reached"
          />
          <StatCard
            label="Failed Calls"
            value={analytics ? analytics.failed_calls : '0'}
            subtext="Incomplete enquiry or declined consent"
            color="#f87171"
          />
          <StatCard
            label="Success Rate"
            value={analytics ? `${analytics.success_rate}%` : '0%'}
            subtext={analytics && analytics.success_rate >= 50 ? '🟢 Strong Completion Rate' : '🟡 Needs Optimization'}
            color="#fbbf24"
          />
          <StatCard
            label="Avg Response Latency"
            value={analytics ? `${analytics.latency.avg_ms} ms` : '0 ms'}
            subtext={analytics ? `Min: ${analytics.latency.min_ms}ms · Max: ${analytics.latency.max_ms}ms` : ''}
            color="#a78bfa"
          />
        </div>

        {/* ─── Failure Types & Track Outcomes Breakdown Grid ─────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          marginBottom: '36px',
        }}>
          {/* Failure Types Panel */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(12px)',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ Failure Categories Breakdown
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(FAILURE_LABELS).map(([key, info]) => {
                const count = analytics?.failure_types?.[key] || 0;
                const totalFailed = analytics?.failed_calls || 1;
                const pct = Math.round((count / (totalFailed || 1)) * 100);

                return (
                  <div key={key} style={{ background: '#020617', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{info.label}</span>
                      <span style={{ fontWeight: 800, color: '#f87171' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>{info.desc}</div>
                    <div style={{ height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #f87171, #ef4444)', borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Track-Specific Outcomes Panel */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(12px)',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px', color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏦 Financial Services Track Outcomes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(TRACK_OUTCOME_LABELS).map(([key, labelText]) => {
                const count = analytics?.track_outcomes?.[key] || 0;
                const total = analytics?.total_calls || 1;
                const pct = Math.round((count / (total || 1)) * 100);

                return (
                  <div key={key} style={{ background: '#020617', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(20, 184, 166, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{labelText}</span>
                      <span style={{ fontWeight: 800, color: '#2dd4bf' }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #14b8a6)', borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Call History Table ─────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(30, 41, 59, 0.8)',
          borderRadius: '20px',
          padding: '24px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                📋 Call History Log (Protected PII)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Shows recent actual calls, duration, channel, speech latency, and success status
              </p>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8', background: '#020617', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              Showing {calls.length} calls
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              Loading call logs...
            </div>
          ) : calls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#020617', borderRadius: '16px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📞</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#cbd5e1' }}>No call records found</div>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                Place a browser or SIP call using the voice agent to record real analytics data.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.8)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 16px' }}>Time</th>
                    <th style={{ padding: '12px 16px' }}>Caller</th>
                    <th style={{ padding: '12px 16px' }}>Channel</th>
                    <th style={{ padding: '12px 16px' }}>Language</th>
                    <th style={{ padding: '12px 16px' }}>Track Outcome</th>
                    <th style={{ padding: '12px 16px' }}>Latency</th>
                    <th style={{ padding: '12px 16px' }}>Duration</th>
                    <th style={{ padding: '12px 16px' }}>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => {
                    const isSuccess = c.outcome === 'success';
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid rgba(30, 41, 59, 0.5)' }}>
                        <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                          <div style={{ fontWeight: 600 }}>{timeAgo(c.created_at)}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{formatDate(c.created_at)}</div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#f8fafc', fontWeight: 600 }}>
                          {c.caller_name}
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>ID: {c.user_id}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                            background: c.channel === 'sip' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: c.channel === 'sip' ? '#c084fc' : '#38bdf8',
                            border: `1px solid ${c.channel === 'sip' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                          }}>
                            {c.channel === 'sip' ? '📞 SIP Trunk' : '💻 Browser'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                          {c.language === 'hi-IN' ? '🇮🇳 Hindi' : '🇬🇧 English'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#e2e8f0', fontWeight: 600 }}>
                          {TRACK_OUTCOME_LABELS[c.track_outcome] || c.track_outcome}
                          {c.scheme_checked && (
                            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              {c.scheme_checked}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#a78bfa', fontWeight: 700, fontFamily: 'monospace' }}>
                          {c.latency_ms > 0 ? `${c.latency_ms} ms` : '-'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#94a3b8' }}>
                          {formatDuration(c.duration_seconds)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, width: 'fit-content',
                              background: isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: isSuccess ? '#34d399' : '#f87171',
                              border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            }}>
                              {isSuccess ? '✓ SUCCESS' : '✕ FAILED'}
                            </span>
                            {!isSuccess && c.failure_type && (
                              <span style={{ fontSize: '10px', color: '#fca5a5' }}>
                                {FAILURE_LABELS[c.failure_type]?.label || c.failure_type}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
