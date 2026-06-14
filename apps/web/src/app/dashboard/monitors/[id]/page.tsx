'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import api, { Monitor, MonitorStats, LatencyBucket, Check, Incident } from '../../../../lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function formatTimestamp(isoString: string, windowType: '24h' | '7d' | '30d'): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  if (windowType === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (windowType === '7d') {
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.getHours()}:00`;
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function MonitorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const monitorId = params.id as string;

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data States
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [latency, setLatency] = useState<LatencyBucket[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  
  // Toggle states
  const [windowType, setWindowType] = useState<'24h' | '7d' | '30d'>('24h');
  const [checksPage, setChecksPage] = useState(1);
  const [incidentsPage, setIncidentsPage] = useState(1);
  const [checksPagination, setChecksPagination] = useState({ pages: 1 });
  const [incidentsPagination, setIncidentsPagination] = useState({ pages: 1 });

  // Handle mounting for Recharts to avoid SSR hydration mismatches
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadMonitorData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [monRes, statsRes, latRes, checksRes, incRes] = await Promise.all([
        api.getMonitor(monitorId),
        api.getMonitorStats(monitorId, windowType),
        api.getMonitorLatency(monitorId, windowType),
        api.getMonitorChecks(monitorId, windowType, checksPage, 10),
        api.getMonitorIncidents(monitorId, incidentsPage, 10),
      ]);

      setMonitor(monRes.monitor);
      setStats(statsRes);
      setLatency(latRes);
      setChecks(checksRes?.checks || []);
      setChecksPagination(checksRes?.pagination || { pages: 1 });
      setIncidents(incRes?.incidents || []);
      setIncidentsPagination(incRes?.pagination || { pages: 1 });
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to chart logs from the watchtower.');
    } finally {
      setLoading(false);
    }
  };

  // Reload when window or pages change
  useEffect(() => {
    if (monitorId) {
      loadMonitorData(true);
    }
  }, [monitorId, windowType, checksPage, incidentsPage]);

  // Handle pause / resume
  const handlePauseResume = async () => {
    if (!monitor) return;
    try {
      if (monitor.active) {
        await api.pauseMonitor(monitor.id);
      } else {
        await api.resumeMonitor(monitor.id);
      }
      loadMonitorData(false);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!monitor) return;
    if (!confirm(`Are you sure you want to delete "${monitor.name}"? This action is permanent.`)) {
      return;
    }
    try {
      await api.deleteMonitor(monitor.id);
      router.push('/dashboard');
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  if (loading && !monitor) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
        <div className="skeleton" style={{ height: '40px', width: '200px', borderRadius: '4px' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '110px', borderRadius: '10px' }}></div>
          ))}
        </div>
        <div className="skeleton" style={{ height: '300px', borderRadius: '10px' }}></div>
      </div>
    );
  }

  if (error && !monitor) {
    return (
      <div className="panel-dark" style={{ textAlign: 'center', padding: '3rem', margin: '2rem 0' }}>
        <svg style={{ margin: '0 auto 1.5rem', color: 'var(--storm)' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <h3>Monitor Disconnected</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '28rem', margin: '0.5rem auto 1.5rem' }}>{error}</p>
        <Link href="/dashboard" className="btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  if (!monitor) return null;

  // Prepare chart data
  const chartData = latency.map((row) => ({
    ...row,
    timeLabel: formatTimestamp(String(row.bucket), windowType),
  }));

  const activeIncidents = incidents.filter(i => !i.resolvedAt).length;

  return (
    <div>
      {/* ===== Monitor Header Area ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--gold)', fontWeight: 600 }}>Monitor Detail</span>
          <h2 style={{ fontFamily: 'var(--ff-display, Fraunces, Georgia, serif)', fontSize: '1.6rem', margin: '0.2rem 0 0.15rem', color: 'var(--parchment)', letterSpacing: '-.01em', fontWeight: 700 }}>
            {monitor.name}
          </h2>
          <a href={monitor.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', opacity: 0.8, textDecoration: 'underline' }}>
            {monitor.url}
          </a>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href={`/status/${monitor.slug}`} target="_blank" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', boxShadow: 'none' }}>
            Public Status Page
          </Link>
          <button onClick={handlePauseResume} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'none', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'var(--parchment)', boxShadow: 'none' }}>
            {monitor.active ? 'Pause Watch' : 'Resume Watch'}
          </button>
          <button onClick={handleDelete} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'linear-gradient(180deg, #bf3b2c, #8a2a1f)', color: 'var(--lh-white)', border: '1px solid #8a2a1f', boxShadow: 'none' }}>
            Delete
          </button>
        </div>
      </div>

      {/* ===== Metrics Row ===== */}
      <section className="stat-row">
        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <div className="stat-top">Signal Status</div>
          <p className="stat-value" style={{ 
            color: !monitor.active 
              ? 'var(--ink)' 
              : monitor.status === 'UP' 
                ? '#27522f' 
                : monitor.status === 'DEGRADED' 
                  ? '#5e3f0a' 
                  : '#6b1e1c' 
          }}>
            {monitor.active ? (monitor.status === 'UP' ? 'Calm' : monitor.status === 'DEGRADED' ? 'Rough' : 'Storm') : 'Paused'}
          </p>
          <p className="stat-sub">
            {monitor.active ? `Reporting normally every ${monitor.interval}s` : 'Monitor is currently paused'}
          </p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v6M9 6l3-4 3 4"/><path d="M5 11h14l-1.5 7a2 2 0 0 1-2 1.6H8.5a2 2 0 0 1-2-1.6z"/></svg>
          <div className="stat-top">Uptime ({windowType})</div>
          <p className="stat-value">{stats ? `${stats.uptimePercent.toFixed(2)}%` : '100.0%'}</p>
          <p className="stat-sub">{stats ? stats.totalChecks : 0} total signal pings</p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          <div className="stat-top">Avg Latency</div>
          <p className="stat-value">{stats?.avgResponseTime ? `${stats.avgResponseTime}ms` : '—'}</p>
          <p className="stat-sub">Response roundtrip speed</p>
        </div>

        <div className="stat-card">
          <svg className="bg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v10M9 6l3-3 3 3"/></svg>
          <div className="stat-top">Storm Outages</div>
          <p className="stat-value" style={{ color: activeIncidents > 0 ? '#6b1e1c' : 'inherit' }}>{activeIncidents}</p>
          <p className="stat-sub">Ongoing incident warnings</p>
        </div>
      </section>

      {/* ===== Latency Chart Panel ===== */}
      <section className="panel-dark" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>Monitor Latency Profile</h2>
          <div className="time-filter">
            <button className={`time-filter-btn ${windowType === '24h' ? 'active' : ''}`} onClick={() => setWindowType('24h')}>24h</button>
            <button className={`time-filter-btn ${windowType === '7d' ? 'active' : ''}`} onClick={() => setWindowType('7d')}>7 Days</button>
            <button className={`time-filter-btn ${windowType === '30d' ? 'active' : ''}`} onClick={() => setWindowType('30d')}>30 Days</button>
          </div>
        </div>

        <div style={{ width: '100%', height: 260, position: 'relative' }}>
          {isMounted && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,163,92,0.06)" />
                <XAxis 
                  dataKey="timeLabel" 
                  stroke="rgba(201,163,92,0.4)" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="rgba(201,163,92,0.4)" 
                  fontSize={10} 
                  tickLine={false}
                  unit="ms" 
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="custom-tooltip">
                          <p className="label">{new Date(data.bucket).toLocaleString()}</p>
                          <p style={{ color: 'var(--gold)' }}>Average: <b>{data.avg}ms</b></p>
                          <p style={{ color: 'var(--text-secondary)' }}>Range: {data.min}ms - {data.max}ms</p>
                        </div>
                      );
                    }
                    return null;
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="avg" 
                  stroke="var(--gold)" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#latencyGlow)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : isMounted ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', opacity: 0.6, fontSize: '0.85rem' }}>
              No latency metrics logged in this window.
            </div>
          ) : (
            <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: '6px' }}></div>
          )}
        </div>
      </section>

      {/* ===== Grid: Check History & Incident logs ===== */}
      <div className="grid-detail">
        {/* Left column: Check logs */}
        <section className="panel-dark">
          <h2>Signal Log History</h2>
          
          {checks.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', opacity: 0.6 }}>
              No logs charted.
            </div>
          ) : (
            <>
              <div className="checks-table-container">
                <table className="checks-table">
                  <thead>
                    <tr>
                      <th>Time Checked</th>
                      <th>Signal Status</th>
                      <th>Latency</th>
                      <th>Response Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((check) => (
                      <tr key={check.id}>
                        <td>{new Date(check.checkedAt).toLocaleString()}</td>
                        <td>
                          <span className={`status-pill surface ${
                            check.status === 'UP' ? 'green' : check.status === 'DEGRADED' ? 'amber' : 'red'
                          }`}>
                            {check.status === 'UP' ? 'Operational' : check.status === 'DEGRADED' ? 'Degraded' : 'Storm Outage'}
                          </span>
                        </td>
                        <td>{check.responseTime}ms</td>
                        <td>
                          {check.statusCode 
                            ? check.statusCode 
                            : <span style={{ color: 'var(--storm)', fontSize: '0.8rem' }}>{check.error || 'Connection Failed'}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(checksPagination?.pages || 1) > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    className="time-filter-btn" 
                    disabled={checksPage === 1}
                    onClick={() => setChecksPage(p => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Page {checksPage} of {checksPagination?.pages || 1}</span>
                  <button 
                    className="time-filter-btn" 
                    disabled={checksPage === (checksPagination?.pages || 1)}
                    onClick={() => setChecksPage(p => Math.min(checksPagination?.pages || 1, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right column: Incidents log */}
        <section className="panel-dark">
          <h2>Storm & Outage Log</h2>

          {incidents.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', opacity: 0.6, fontSize: '0.85rem' }}>
              No incidents recorded. All systems operational.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {incidents.map((incident) => (
                  <div key={incident.id} className="incident-item">
                    <div className="incident-item-header">
                      <span style={{ fontWeight: 600 }}>Storm Outage</span>
                      <span className={`incident-badge ${incident.resolvedAt ? 'resolved' : 'open'}`}>
                        {incident.resolvedAt ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Triggered: {new Date(incident.startedAt).toLocaleString()}
                    </div>
                    {incident.resolvedAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Resolved: {new Date(incident.resolvedAt).toLocaleString()}
                      </div>
                    )}
                    <div className="incident-duration">
                      Duration: {incident.durationSeconds 
                        ? `${Math.round(incident.durationSeconds / 60)} min (${incident.durationSeconds}s)` 
                        : incident.resolvedAt ? '< 1 min' : 'Ongoing outage'
                      }
                    </div>
                  </div>
                ))}
              </div>

              {(incidentsPagination?.pages || 1) > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    className="time-filter-btn" 
                    disabled={incidentsPage === 1}
                    onClick={() => setIncidentsPage(p => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Page {incidentsPage} of {incidentsPagination?.pages || 1}</span>
                  <button 
                    className="time-filter-btn" 
                    disabled={incidentsPage === (incidentsPagination?.pages || 1)}
                    onClick={() => setIncidentsPage(p => Math.min(incidentsPagination?.pages || 1, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
