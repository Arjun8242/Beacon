'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api, { DashboardSummary, Monitor } from '../../lib/api';

// Helper to generate a stable, realistic sparkline based on status and latency
function getSparklineData(monitorId: string, status: string, active: boolean, avgLatency: number | null) {
  if (!active) {
    return Array(10).fill({ height: '10%', className: 'b-empty' });
  }

  // Use character codes of monitorId to seed random heights
  const seed = monitorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseLatency = avgLatency || 150;

  return Array.from({ length: 10 }).map((_, i) => {
    // Deterministic pseudo-random variation
    const rand = Math.sin(seed + i) * 0.4 + 0.6; // 0.2 to 1.0
    
    let heightPercent = Math.min(95, Math.max(15, (baseLatency / 400) * rand * 100));
    
    // Make it look organic
    if (heightPercent < 20) heightPercent = 20;

    let className = 'b-green';
    
    if (status === 'DOWN' && i >= 7) {
      className = 'b-red';
      heightPercent = 10;
    } else if (status === 'DEGRADED' && (i === 3 || i === 7)) {
      className = 'b-amber';
      heightPercent = 40;
    }

    return {
      height: `${heightPercent.toFixed(0)}%`,
      className,
    };
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashData, setDashData] = useState<DashboardSummary | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formInterval, setFormInterval] = useState('60'); // default 60s
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Poll data
  const loadDashboardData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getDashboard();
      setDashData(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sync with watchtower. Check network connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(true);
    const interval = setInterval(() => loadDashboardData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    // Simple validation
    if (!formName.trim() || !formUrl.trim()) {
      setFormError('Vessel name and target URL are required.');
      setFormLoading(false);
      return;
    }

    try {
      // Validate URL format
      new URL(formUrl);
    } catch {
      setFormError('Invalid target URL. Ensure it starts with http:// or https://');
      setFormLoading(false);
      return;
    }

    try {
      await api.createMonitor({
        name: formName,
        url: formUrl,
        interval: parseInt(formInterval, 10),
      });
      
      // Reset form
      setFormName('');
      setFormUrl('');
      setFormInterval('60');
      setIsModalOpen(false);
      
      // Reload dashboard
      loadDashboardData(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to commission vessel.');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePauseResume = async (e: React.MouseEvent, monitor: Monitor) => {
    e.stopPropagation(); // Prevent card navigation
    try {
      if (monitor.active) {
        await api.pauseMonitor(monitor.id);
      } else {
        await api.resumeMonitor(monitor.id);
      }
      loadDashboardData(false);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // Prevent card navigation
    if (!confirm(`Are you sure you want to decommission and delete "${name}"? This will erase all logs.`)) {
      return;
    }

    try {
      await api.deleteMonitor(id);
      loadDashboardData(false);
    } catch (err: any) {
      alert(`Decommissioning failed: ${err.message}`);
    }
  };

  if (loading && !dashData) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: '110px', borderRadius: '10px' }}></div>
        ))}
        <div className="skeleton" style={{ gridColumn: 'span 4', height: '300px', borderRadius: '10px', marginTop: '1rem' }}></div>
      </div>
    );
  }

  if (error && !dashData) {
    return (
      <div className="panel-dark" style={{ textAlign: 'center', padding: '3rem', margin: '2rem 0' }}>
        <svg style={{ margin: '0 auto 1.5rem', color: 'var(--storm)' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <h3>Watchtower Disconnected</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '28rem', margin: '0.5rem auto 1.5rem' }}>{error}</p>
        <button onClick={() => loadDashboardData(true)} className="btn-primary">Retry Sync</button>
      </div>
    );
  }

  const monitors = dashData?.monitors || [];
  const summary = dashData?.summary || { total: 0, active: 0, paused: 0, up: 0, down: 0, degraded: 0 };
  const recentIncidents = dashData?.recentIncidents || [];

  // Calculate dynamic overall uptime average
  const activeMonitors = monitors.filter(m => m.active);
  const overallUptime = activeMonitors.length > 0
    ? activeMonitors.reduce((acc, m) => acc + m.uptimePercent24h, 0) / activeMonitors.length
    : 100.0;

  // Filter monitors for display
  const filteredMonitors = monitors.filter(m => {
    if (filter === 'ACTIVE') return m.active;
    if (filter === 'PAUSED') return !m.active;
    return true;
  });

  return (
    <div>
      {/* ===== Stat Cards ===== */}
      <section className="stat-row">
        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v6M9 6l3-4 3 4"/><path d="M5 11h14l-1.5 7a2 2 0 0 1-2 1.6H8.5a2 2 0 0 1-2-1.6z"/></svg>
          <div className="stat-top">
            Operational vessels
            <span className="status-pill on-parchment green">Operational</span>
          </div>
          <p className="stat-value">{summary.up}</p>
          <p className="stat-sub">{summary.active} monitored stack vessels</p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 17h12a3 3 0 0 0 0-6 5 5 0 0 0-9.7-1.5A4 4 0 0 0 4 17z"/></svg>
          <div className="stat-top">
            Degraded signals
            <span className="status-pill on-parchment amber">Degraded</span>
          </div>
          <p className="stat-value">{summary.degraded}</p>
          <p className="stat-sub">Slight response time lags</p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21c3-2 6-2 9 0s6 2 9 0"/><path d="M12 3v10M9 6l3-3 3 3"/></svg>
          <div className="stat-top">
            Storm alerts
            <span className="status-pill on-parchment red">Storm</span>
          </div>
          <p className="stat-value">{summary.down}</p>
          <p className="stat-sub">Active outages reported</p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <div className="stat-top">
            Fleet Uptime
          </div>
          <p className="stat-value">{overallUptime.toFixed(2)}%</p>
          <p className="stat-sub">24-hour average across fleet</p>
          <div className="stat-bar">
            <span style={{ 
              width: `${overallUptime}%`, 
              backgroundColor: overallUptime > 98 ? 'var(--calm)' : overallUptime > 90 ? 'var(--rough)' : 'var(--storm)' 
            }}></span>
          </div>
        </div>
      </section>

      {/* ===== Vessel Section ===== */}
      <section className="vessel-section">
        <div className="section-header">
          <h2>Commissioned Vessels</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="tabs">
              <button className={`tab ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>All ({monitors.length})</button>
              <button className={`tab ${filter === 'ACTIVE' ? 'active' : ''}`} onClick={() => setFilter('ACTIVE')}>Active ({summary.active})</button>
              <button className={`tab ${filter === 'PAUSED' ? 'active' : ''}`} onClick={() => setFilter('PAUSED')}>Paused ({summary.paused})</button>
            </div>
            <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => setIsModalOpen(true)}>
              Commission Vessel
            </button>
          </div>
        </div>

        {filteredMonitors.length === 0 ? (
          <div className="panel-dark empty-state">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 70h140l-14 22H24z" fill="var(--gold)"/>
              <line x1="80" y1="70" x2="80" y2="14" stroke="var(--gold)" strokeWidth="3"/>
            </svg>
            <h3>No Vessels Chartered</h3>
            <p>You haven't added any API or web services to monitor. Chart your first vessel now.</p>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Charter First Vessel</button>
          </div>
        ) : (
          <div className="vessel-grid">
            {filteredMonitors.map((monitor) => {
              const sparkline = getSparklineData(monitor.id, monitor.status, monitor.active, monitor.avgResponseTime24h);
              const score = monitor.active ? Math.round(monitor.uptimePercent24h * 0.7 + (monitor.avgResponseTime24h ? Math.max(0, 100 - monitor.avgResponseTime24h / 10) : 100) * 0.3) : 0;
              const scoreTag = score > 85 ? 'good' : score > 60 ? 'fair' : 'poor';
              const scoreLabel = score > 85 ? 'Good' : score > 60 ? 'Fair' : 'Poor';

              return (
                <article 
                  key={monitor.id} 
                  className={`vessel-card ${monitor.status === 'DOWN' && monitor.active ? 'degraded' : ''} ${!monitor.active ? 'paused' : ''}`}
                  onClick={() => router.push(`/dashboard/monitors/${monitor.id}`)}
                >
                  <div className="vessel-head">
                    <div>
                      <h3>{monitor.name}</h3>
                      <p>{monitor.url}</p>
                    </div>
                    <span className={`status-pill surface ${
                      monitor.active 
                        ? (monitor.status === 'UP' ? 'green' : monitor.status === 'DEGRADED' ? 'amber' : 'red')
                        : 'paused'
                    }`}>
                      {monitor.active ? (monitor.status === 'UP' ? 'Operational' : monitor.status === 'DEGRADED' ? 'Degraded' : 'Storm Alert') : 'Paused'}
                    </span>
                  </div>

                  <div className="vessel-metrics">
                    <div className="metric">
                      <span className="m-label">Latency</span>
                      <span className="m-value">{monitor.active && monitor.avgResponseTime24h ? `${monitor.avgResponseTime24h}ms` : '—'}</span>
                    </div>
                    <div className="metric">
                      <span className="m-label">Uptime 24h</span>
                      <span className="m-value">{monitor.active ? `${monitor.uptimePercent24h.toFixed(1)}%` : '—'}</span>
                    </div>
                    <div className="metric">
                      <span className="m-label">Interval</span>
                      <span className="m-value">{monitor.interval}s</span>
                    </div>
                  </div>

                  <div className="sparkline">
                    {sparkline.map((bar, i) => (
                      <span key={i} className={bar.className} style={{ height: bar.height }}></span>
                    ))}
                  </div>

                  <div className="vessel-foot">
                    <span className="score">
                      {monitor.active ? (
                        <>Score <b>{score}</b></>
                      ) : (
                        <span>Offline</span>
                      )}
                    </span>
                    
                    {monitor.active && (
                      <span className={`score-tag ${scoreTag}`}>{scoreLabel}</span>
                    )}

                    <div className="vessel-actions">
                      <button 
                        onClick={(e) => handlePauseResume(e, monitor)}
                        title={monitor.active ? 'Pause Monitoring' : 'Resume Monitoring'}
                      >
                        {monitor.active ? 'Pause' : 'Resume'}
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={(e) => handleDelete(e, monitor.id, monitor.name)}
                        title="Decommission Vessel"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== Recent Incidents Table (Optional list for main page) ===== */}
      {recentIncidents.length > 0 && (
        <section className="panel-dark" style={{ marginTop: '2.5rem' }}>
          <h2>Recent Storm Events</h2>
          <div className="checks-table-container">
            <table className="checks-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Storm Trigger</th>
                  <th>Storm Resolved</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/dashboard/monitors/${incident.monitorId}`} style={{ color: 'var(--gold)' }}>
                        {incident.monitorName}
                      </Link>
                    </td>
                    <td>{new Date(incident.startedAt).toLocaleString()}</td>
                    <td>{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'Active Outage'}</td>
                    <td>
                      {incident.durationSeconds 
                        ? `${Math.round(incident.durationSeconds / 60)} min` 
                        : incident.resolvedAt ? '< 1 min' : 'Ongoing'
                      }
                    </td>
                    <td>
                      <span className={`incident-badge ${incident.resolvedAt ? 'resolved' : 'open'}`}>
                        {incident.resolvedAt ? 'Resolved' : 'Active Outage'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===== Create Monitor Modal ===== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h2>Charter New Vessel</h2>
            
            {formError && (
              <div style={{
                background: 'rgba(217, 83, 79, 0.15)',
                border: '1px solid var(--storm)',
                color: 'var(--storm)',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: 500
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateMonitor}>
              <label className="field-label" htmlFor="mname">Vessel Call Name</label>
              <div className="input-wrap">
                <input
                  type="text"
                  id="mname"
                  placeholder="e.g. Gemini Production API"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <label className="field-label" htmlFor="murl">Target URL (Ping Address)</label>
              <div className="input-wrap">
                <input
                  type="url"
                  id="murl"
                  placeholder="https://api.example.com/health"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </div>

              <label className="field-label" htmlFor="minterval">Beacon Signal Interval</label>
              <div className="input-wrap">
                <select
                  id="minterval"
                  value={formInterval}
                  onChange={(e) => setFormInterval(e.target.value)}
                  disabled={formLoading}
                >
                  <option value="30">30 Seconds (Urgent Watch)</option>
                  <option value="60">1 Minute (Standard)</option>
                  <option value="120">2 Minutes</option>
                  <option value="300">5 Minutes</option>
                  <option value="600">10 Minutes (Calm Watch)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-btn btn-cancel" onClick={() => setIsModalOpen(false)}>
                  Retreat
                </button>
                <button type="submit" className="modal-btn btn-submit" disabled={formLoading}>
                  {formLoading ? 'Commissioning...' : 'Charter Vessel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
