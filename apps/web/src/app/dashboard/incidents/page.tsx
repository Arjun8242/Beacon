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
      <div className="incidents-skeleton-wrap">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton skeleton--incident" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-dark dash-error-panel">
        <svg className="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <h3>Failed to load incidents</h3>
        <p className="error-desc">{error}</p>
        <button className="btn-primary btn-primary--sm" onClick={() => loadData(true)}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ===== Page Header ===== */}
      <div className="page-header">
        <span className="monitor-eyebrow">Storm Log</span>
        <h2 className="page-title">Incident History</h2>
        <p className="page-subtitle">
          A log of all detected outages and degraded signals across your monitors.
        </p>
      </div>

      {/* ===== Summary Stats ===== */}
      <section className="stat-row stat-row--3col">
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
          <p className={`stat-value ${summary.open > 0 ? 'text-status-down' : ''}`}>{summary.open}</p>
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
        <section className="panel-dark panel-dark--alert">
          <h2 className="panel-alert-heading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Active Storm Events — {activeOutages.length} service{activeOutages.length > 1 ? 's' : ''} affected
          </h2>
          <div className="outages-list">
            {activeOutages.map(monitor => (
              <Link
                key={monitor.id}
                href={`/dashboard/monitors/${monitor.id}`}
                className="outage-link"
              >
                <div className="outage-link-left">
                  <span
                    className={`outage-dot ${monitor.status === 'DOWN' ? 'is-down' : 'is-degraded'}`}
                  />
                  <div>
                    <span className="outage-name">{monitor.name}</span>
                    <span className="outage-url">{monitor.url}</span>
                  </div>
                </div>
                <div className="outage-link-right">
                  <span className={`status-pill surface ${monitor.status === 'DOWN' ? 'red' : 'amber'}`}>
                    {monitor.status === 'DOWN' ? 'Storm Alert' : 'Degraded'}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="icon-muted">
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
        <h2 className="panel-section-h2">Storm Event Log</h2>

        {incidents.length === 0 ? (
          <div className="table-empty-full">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="table-empty-icon">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="table-empty-text">No incidents recorded. All monitors are sailing smoothly.</p>
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
                  <tr key={incident.id} className="tr-clickable">
                    <td className="td-monitor">
                      <Link
                        href={`/dashboard/monitors/${incident.monitorId}`}
                        className="incident-monitor-link"
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
                    <td className={incident.resolvedAt ? 'text-parchment' : 'text-storm'}>
                      {incident.resolvedAt
                        ? <span title={new Date(incident.resolvedAt).toLocaleString()}>{timeAgo(incident.resolvedAt)}</span>
                        : <span className="ongoing-label">Ongoing ⚡</span>
                      }
                    </td>
                    <td className="td-mono">
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
                        className="icon-muted"
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
      <p className="incidents-footer-note">
        Showing recent incidents · auto-refreshes every 30s
      </p>
    </div>
  );
}
