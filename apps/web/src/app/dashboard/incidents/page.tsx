'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { DashboardSummary, Monitor } from '../../../lib/api';

type RecentIncident = DashboardSummary['recentIncidents'][number];

function formatDuration(seconds: number | null, resolvedAt: string | null): string {
  if (!seconds) return resolvedAt ? '< 1 min' : 'Ongoing';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hrs`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IncidentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<RecentIncident[]>([]);
  const [activeOutages, setActiveOutages] = useState<Monitor[]>([]);
  const [summary, setSummary] = useState({ total: 0, open: 0, resolved: 0 });

  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getDashboard();
      const inc = data.recentIncidents || [];
      setIncidents(inc);

      // Active outages = monitors currently DOWN or DEGRADED
      const outages = (data.monitors || []).filter(
        m => m.active && (m.status === 'DOWN' || m.status === 'DEGRADED')
      );
      setActiveOutages(outages);

      const open = inc.filter(i => !i.resolvedAt).length;
      setSummary({ total: inc.length, open, resolved: inc.length - open });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load incident data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '10px' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-dark" style={{ textAlign: 'center', padding: '3rem' }}>
        <svg style={{ margin: '0 auto 1.5rem', color: 'var(--storm)' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <h3>Failed to load incidents</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn-primary" onClick={() => loadData(true)} style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ===== Page Header ===== */}
      <div style={{ marginBottom: '1.75rem' }}>
        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--gold)', fontWeight: 600 }}>
          Storm Log
        </span>
        <h2 style={{ fontFamily: 'var(--ff-display, Fraunces, Georgia, serif)', fontSize: '1.5rem', margin: '0.2rem 0 0.3rem', color: 'var(--parchment)', fontWeight: 700 }}>
          Incident History
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
          A log of all detected outages and degraded signals across your monitors.
        </p>
      </div>

      {/* ===== Summary Stats ===== */}
      <section className="stat-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: '2rem' }}>
        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3v10M9 6l3-3 3 3"/>
            <path d="M3 21c3-2 6-2 9 0s6 2 9 0"/>
          </svg>
          <div className="stat-top">Total Incidents</div>
          <p className="stat-value">{summary.total}</p>
          <p className="stat-sub">In recent history</p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div className="stat-top">
            Active Outages
            {summary.open > 0 && <span className="status-pill on-parchment red">Live</span>}
          </div>
          <p className="stat-value" style={{ color: summary.open > 0 ? '#6b1e1c' : 'inherit' }}>{summary.open}</p>
          <p className="stat-sub">{summary.open > 0 ? 'Requires attention' : 'All clear'}</p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div className="stat-top">
            Resolved
            {summary.resolved > 0 && <span className="status-pill on-parchment green">Closed</span>}
          </div>
          <p className="stat-value">{summary.resolved}</p>
          <p className="stat-sub">Incidents resolved</p>
        </div>
      </section>

      {/* ===== Active Outages Banner ===== */}
      {activeOutages.length > 0 && (
        <section className="panel-dark" style={{ marginBottom: '2rem', borderColor: 'rgba(217,83,79,.35)', background: 'rgba(217,83,79,.06)' }}>
          <h2 style={{ color: 'var(--storm)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Active Storm Events — {activeOutages.length} service{activeOutages.length > 1 ? 's' : ''} affected
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeOutages.map(monitor => (
              <Link
                key={monitor.id}
                href={`/dashboard/monitors/${monitor.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(217,83,79,.08)',
                  border: '1px solid rgba(217,83,79,.25)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: monitor.status === 'DOWN' ? 'var(--storm)' : 'var(--rough)',
                    flexShrink: 0,
                    boxShadow: `0 0 0 3px ${monitor.status === 'DOWN' ? 'rgba(217,83,79,.2)' : 'rgba(224,162,60,.2)'}`,
                  }}/>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--parchment)', fontSize: '0.9rem' }}>{monitor.name}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{monitor.url}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`status-pill surface ${monitor.status === 'DOWN' ? 'red' : 'amber'}`}>
                    {monitor.status === 'DOWN' ? 'Storm Alert' : 'Degraded'}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== Incident History Table ===== */}
      <section className="panel-dark">
        <h2 style={{ marginBottom: '1.25rem' }}>
          Storm Event Log
        </h2>

        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ margin: '0 auto 1rem', opacity: 0.4 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No incidents recorded. All monitors are sailing smoothly.</p>
          </div>
        ) : (
          <div className="checks-table-container">
            <table className="checks-table">
              <thead>
                <tr>
                  <th>Monitor</th>
                  <th>Started</th>
                  <th>Resolved</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(incident => (
                  <tr key={incident.id} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600, color: 'var(--parchment)' }}>
                      <Link
                        href={`/dashboard/monitors/${incident.monitorId}`}
                        style={{ color: 'var(--gold)', textDecoration: 'none' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {incident.monitorName}
                      </Link>
                    </td>
                    <td>
                      <span title={new Date(incident.startedAt).toLocaleString()}>
                        {timeAgo(incident.startedAt)}
                      </span>
                    </td>
                    <td style={{ color: incident.resolvedAt ? 'var(--parchment)' : 'var(--storm)' }}>
                      {incident.resolvedAt
                        ? <span title={new Date(incident.resolvedAt).toLocaleString()}>{timeAgo(incident.resolvedAt)}</span>
                        : <span style={{ fontWeight: 600 }}>Ongoing ⚡</span>
                      }
                    </td>
                    <td style={{ fontFamily: 'var(--ff-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDuration(incident.durationSeconds, incident.resolvedAt)}
                    </td>
                    <td>
                      <span className={`incident-badge ${incident.resolvedAt ? 'resolved' : 'open'}`}>
                        {incident.resolvedAt ? 'Resolved' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/monitors/${incident.monitorId}`}
                        style={{ color: 'var(--text-secondary)', opacity: 0.6, display: 'flex', alignItems: 'center' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== Footer note ===== */}
      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.5, marginTop: '1.5rem' }}>
        Showing recent incidents · auto-refreshes every 30s
      </p>
    </div>
  );
}
