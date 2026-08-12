'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Urgency = 'low' | 'medium' | 'high' | 'emergency';
type Status = 'open' | 'in_progress' | 'resolved';

interface Escalation {
  id: string;
  user_id: string;
  caller_name: string;
  language: string;
  follow_up_method: string;
  issue_category: string;
  issue_summary: string;
  what_agent_checked: string;
  urgency: Urgency;
  status: Status;
  sip_uri: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; bg: string; glow: string }> = {
  emergency: { label: '🔴 Emergency', color: '#ff4444', bg: 'rgba(255,68,68,0.12)', glow: '0 0 16px rgba(255,68,68,0.4)' },
  high:      { label: '🟠 High',      color: '#ff8c00', bg: 'rgba(255,140,0,0.12)',  glow: '0 0 16px rgba(255,140,0,0.35)' },
  medium:    { label: '🟡 Medium',    color: '#ffd700', bg: 'rgba(255,215,0,0.10)',  glow: '0 0 12px rgba(255,215,0,0.3)' },
  low:       { label: '🟢 Low',       color: '#00c853', bg: 'rgba(0,200,83,0.10)',   glow: '0 0 10px rgba(0,200,83,0.25)' },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; next: Status | null; nextLabel: string }> = {
  open:        { label: 'Open',        color: '#6b7cff', next: 'in_progress', nextLabel: 'Mark In Progress' },
  in_progress: { label: 'In Progress', color: '#ffd700', next: 'resolved',    nextLabel: 'Mark Resolved ✓'  },
  resolved:    { label: 'Resolved',    color: '#00c853', next: null,          nextLabel: ''                  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      boxShadow: cfg.glow,
      borderRadius: '999px',
      padding: '2px 10px',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '0.02em',
      display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      background: `${cfg.color}18`,
      color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      borderRadius: '999px',
      padding: '2px 10px',
      fontSize: '12px',
      fontWeight: 700,
      display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}

function EscalationCard({
  esc,
  onStatusChange,
  updating,
}: {
  esc: Escalation;
  onStatusChange: (id: string, status: Status, callback: boolean) => void;
  updating: string | null;
}) {
  const urg = URGENCY_CONFIG[esc.urgency];
  const stat = STATUS_CONFIG[esc.status];
  const isUpdating = updating === esc.id;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${esc.urgency === 'emergency' ? '#ff444440' : '#ffffff15'}`,
      borderRadius: '16px',
      padding: '20px 24px',
      marginBottom: '16px',
      transition: 'box-shadow 0.2s, border-color 0.2s',
      boxShadow: esc.urgency === 'emergency' ? urg.glow : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Urgency accent bar */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: '4px',
        background: urg.color,
        borderRadius: '16px 0 0 16px',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginLeft: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontFamily: 'monospace', color: '#a0aec0', fontWeight: 700 }}>
            #{esc.id}
          </span>
          <UrgencyBadge urgency={esc.urgency} />
          <StatusBadge status={esc.status} />
        </div>
        <span style={{ fontSize: '12px', color: '#718096' }}>
          {timeAgo(esc.created_at)}
        </span>
      </div>

      {/* Caller & Category */}
      <div style={{ marginTop: '14px', marginLeft: '8px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Caller</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>{esc.caller_name}</div>
            <div style={{ fontSize: '12px', color: '#718096' }}>{esc.language} · {esc.follow_up_method}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Category</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#cbd5e0', fontFamily: 'monospace' }}>{esc.issue_category}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Created</div>
            <div style={{ fontSize: '13px', color: '#a0aec0' }}>{formatDate(esc.created_at)}</div>
          </div>
          {esc.resolved_at && (
            <div>
              <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Resolved</div>
              <div style={{ fontSize: '13px', color: '#00c853' }}>{formatDate(esc.resolved_at)}</div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Issue Summary</div>
          <p style={{ fontSize: '14px', color: '#cbd5e0', lineHeight: '1.6', margin: 0 }}>{esc.issue_summary}</p>
        </div>

        {/* What agent checked */}
        {esc.what_agent_checked && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Agent Already Checked</div>
            <p style={{ fontSize: '13px', color: '#a0aec0', lineHeight: '1.5', margin: 0, fontStyle: 'italic' }}>{esc.what_agent_checked}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {stat.next && (
        <div style={{ marginLeft: '8px', marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            id={`btn-advance-${esc.id}`}
            disabled={isUpdating}
            onClick={() => onStatusChange(esc.id, stat.next!, false)}
            style={{
              background: `${STATUS_CONFIG[stat.next].color}22`,
              color: STATUS_CONFIG[stat.next].color,
              border: `1px solid ${STATUS_CONFIG[stat.next].color}55`,
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isUpdating ? 'not-allowed' : 'pointer',
              opacity: isUpdating ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            {isUpdating ? '...' : stat.nextLabel}
          </button>

          {/* If resolved + has SIP URI → offer to trigger callback */}
          {stat.next === 'resolved' && esc.sip_uri && (
            <button
              id={`btn-resolve-callback-${esc.id}`}
              disabled={isUpdating}
              onClick={() => onStatusChange(esc.id, 'resolved', true)}
              style={{
                background: 'rgba(0,200,83,0.18)',
                color: '#00c853',
                border: '1px solid rgba(0,200,83,0.4)',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                opacity: isUpdating ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              {isUpdating ? '...' : '✓ Resolve + Call Back'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchEscalations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (urgencyFilter) params.set('urgency', urgencyFilter);
      const res = await fetch(`/api/escalations${params.toString() ? `?${params}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEscalations(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Could not reach Escalation API. Make sure the FastAPI server is running on port 8001.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter]);

  useEffect(() => {
    fetchEscalations();
    const interval = setInterval(fetchEscalations, 30_000);
    return () => clearInterval(interval);
  }, [fetchEscalations]);

  const handleStatusChange = async (id: string, newStatus: Status, triggerCallback: boolean) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/escalations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, trigger_callback: triggerCallback }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchEscalations();
    } catch (err) {
      alert(`Failed to update escalation: ${err}`);
    } finally {
      setUpdating(null);
    }
  };

  // Summary counts
  const counts = { emergency: 0, high: 0, medium: 0, low: 0, open: 0, in_progress: 0, resolved: 0 };
  escalations.forEach((e) => {
    counts[e.urgency]++;
    counts[e.status]++;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1117 50%, #0a0e1a 100%)',
      fontFamily: "'Inter', 'Public Sans', sans-serif",
      color: '#e2e8f0',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        backdropFilter: 'blur(8px)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em',
            background: 'linear-gradient(90deg, #6b7cff, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🛡️ Cyber Suraksha Kendra
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#718096' }}>
            Human Escalation Dashboard · Auto-refreshes every 30s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#718096' }}>
            Last updated: {lastRefresh.toLocaleTimeString('en-IN')}
          </span>
          <button
            id="btn-refresh"
            onClick={() => { setLoading(true); fetchEscalations(); }}
            style={{
              background: 'rgba(107,124,255,0.15)',
              color: '#6b7cff',
              border: '1px solid rgba(107,124,255,0.35)',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>
        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
          {([
            { label: 'Total',       value: escalations.length,  color: '#a0aec0' },
            { label: 'Open',        value: counts.open,         color: '#6b7cff' },
            { label: 'In Progress', value: counts.in_progress,  color: '#ffd700' },
            { label: 'Resolved',    value: counts.resolved,     color: '#00c853' },
            { label: 'Emergency',   value: counts.emergency,    color: '#ff4444' },
            { label: 'High',        value: counts.high,         color: '#ff8c00' },
          ] as const).map((stat) => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: '12px',
              padding: '14px 20px',
              minWidth: '90px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: '#718096' }}>Filter by:</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            id="filter-urgency"
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="">All Urgencies</option>
            <option value="emergency">🔴 Emergency</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
          {(statusFilter || urgencyFilter) && (
            <button
              id="btn-clear-filters"
              onClick={() => { setStatusFilter(''); setUrgencyFilter(''); }}
              style={{
                background: 'none', color: '#718096',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '7px 12px',
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            background: 'rgba(255,68,68,0.1)',
            border: '1px solid rgba(255,68,68,0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            color: '#ff6b6b',
            fontSize: '14px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#718096' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⟳</div>
            Loading escalations...
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && escalations.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#a0aec0', marginBottom: '8px' }}>
              No escalations found
            </div>
            <div style={{ fontSize: '14px', color: '#718096' }}>
              {statusFilter || urgencyFilter
                ? 'No tickets match the selected filters.'
                : 'All clear! No human escalation requests yet.'}
            </div>
          </div>
        )}

        {/* Cards */}
        {!loading && escalations.length > 0 && (
          <div>
            {escalations.map((esc) => (
              <EscalationCard
                key={esc.id}
                esc={esc}
                onStatusChange={handleStatusChange}
                updating={updating}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        button:hover:not(:disabled) { opacity: 0.85 !important; transform: translateY(-1px); }
        select option { background: #1a202c; color: #e2e8f0; }
      `}</style>
    </div>
  );
}
