'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import api, { Monitor } from '../../lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Monitor[]>([]);
  const [incidentCount, setIncidentCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!api.isAuthenticated()) {
        router.push('/auth/login');
      } else {
        setIsAuth(true);
        fetchSidebarData();
        
        // Poll watchlist every 30s
        const interval = setInterval(fetchSidebarData, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [router]);

  const fetchSidebarData = async () => {
    try {
      const dashData = await api.getDashboard();
      setWatchlist(dashData.monitors || []);
      const downDegradedCount = dashData.monitors.filter(m => m.status === 'DOWN' || m.status === 'DEGRADED').length;
      setIncidentCount(downDegradedCount);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load sidebar data:', err);
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    api.clearToken();
    router.push('/');
  };

  if (!isAuth && loading) {
    return (
      <div className="dash-loading-screen">
        <div className="dash-loading-inner">
          <h2>Loading Dashboard...</h2>
          <div className="skeleton w-[120px] h-[4px] my-4 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!isAuth) return null;

  return (
    <div className="app-dashboard">
      <aside className="sidebar">
        <div className="brand">
          <Link href="/" className="flex items-center gap-2">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M16 36h8l-1-6h-6z" fill="currentColor" opacity=".5"/>
              <path d="M14 30h12l-2-18h-8z" fill="currentColor"/>
              <rect x="15" y="18" width="10" height="3" fill="#bf3b2c"/>
              <rect x="16" y="11" width="8" height="6" fill="currentColor" opacity=".5"/>
              <path d="M14 11l6-7 6 7z" fill="#bf3b2c"/>
            </svg>
            BEACON
          </Link>
        </div>

        <p className="sidebar-eyebrow">Monitoring</p>
        <p className="sidebar-title">Dashboard</p>

        <nav className="side-nav">
          <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>
            Overview
          </Link>
          <Link href="/dashboard" className={pathname.startsWith('/dashboard/monitors') ? 'active' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Monitors
          </Link>
          <Link href="/dashboard/incidents" className={`relative ${pathname === '/dashboard/incidents' ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>
            Incidents
            {incidentCount > 0 && <span className="nav-badge">{incidentCount}</span>}
          </Link>
        </nav>

        <div className="quick-watch" id="monitors">
          <p className="sidebar-eyebrow">Monitors</p>
          <p className="sidebar-title sidebar-title--sm">Active Monitors</p>
          {watchlist.length === 0 ? (
            <p className="qw-empty">No monitors registered.</p>
          ) : (
            <ul className="qw-list">
              {watchlist.map((monitor) => (
                <li key={monitor.id}>
                  <span className={`dot ${
                    monitor.active 
                      ? (monitor.status === 'UP' ? 'green' : monitor.status === 'DEGRADED' ? 'amber' : 'red')
                      : 'paused'
                  }`}></span>
                  <Link href={`/dashboard/monitors/${monitor.id}`} className="qw-name" title={monitor.name}>
                    {monitor.name}
                  </Link>
                  <span className="qw-value">{monitor.active ? `${monitor.uptimePercent24h.toFixed(1)}%` : 'PAUSED'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sidebar-footer">
          <span>v1.3.0</span>
          <span className="live"><span className="pulse"></span>Live</span>
        </div>
      </aside>

      <main className="main-dashboard">
        <div className="topbar-dash">
          <div>
            <h1>Dashboard</h1>
            <p className="topbar-dash-sub">
              {watchlist.length > 0
                ? `${watchlist.filter(m => m.status === 'UP' && m.active).length} of ${watchlist.filter(m => m.active).length} operational · live reporting`
                : 'Welcome. Add your first monitor.'
              }
            </p>
          </div>
          <div className="topbar-dash-actions">
            <Link href="/">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home Deck
            </Link>
            <button onClick={handleSignOut}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
