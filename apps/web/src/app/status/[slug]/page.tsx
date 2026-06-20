'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api, { PublicStatusResponse } from '../../../lib/api';

export default function PublicStatusPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<PublicStatusResponse | null>(null);

  const loadPublicStatus = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getPublicStatus(slug);
      setStatusData(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to establish contact with the lighthouse.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      document.body.classList.add('auth-body');
      loadPublicStatus(true);
      
      const interval = setInterval(() => loadPublicStatus(false), 30000);
      
      return () => {
        document.body.classList.remove('auth-body');
        clearInterval(interval);
      };
    }
  }, [slug]);

  if (loading && !statusData) {
    return (
      <div className="dash-loading-screen">
        <div className="dash-loading-inner">
          <h2>Scanning the horizon...</h2>
          <div className="skeleton w-[120px] h-[4px] my-4 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error && !statusData) {
    return (
      <div className="status-error-page">
        <div className="stars-auth" aria-hidden="true"></div>
        <header className="topnav">
          <div className="brand">
            <Link href="/">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="brand-svg">
                <path d="M16 36h8l-1-6h-6z" fill="currentColor" opacity=".5"/>
                <path d="M14 30h12l-2-18h-8z" fill="currentColor"/>
                <rect x="15" y="18" width="10" height="3" fill="var(--lh-red)"/>
                <rect x="16" y="11" width="8" height="6" fill="currentColor" opacity=".5"/>
                <path d="M14 11l6-7 6 7z" fill="var(--lh-red)"/>
              </svg>
              BEACON
            </Link>
          </div>
        </header>
        <main className="auth-stage auth-stage--top">
          <section className="auth-card auth-card--center">
            <svg className="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <h1 className="error-heading">Lighthouse Beacon Lost</h1>
            <p className="subtitle">{error}</p>
            <Link href="/" className="enter-btn enter-btn--link">
              Return to Safe Waters
            </Link>
          </section>
        </main>
      </div>
    );
  }

  if (!statusData) return null;

  const isUp = statusData.status === 'UP';
  const isDegraded = statusData.status === 'DEGRADED';
  const isDown = statusData.status === 'DOWN';
  const isPaused = statusData.status === 'PAUSED';

  let statusLabel = 'Operational';
  let statusClass = 'calm';
  if (isDegraded) {
    statusLabel = 'Degraded Performance';
    statusClass = 'rough';
  } else if (isDown) {
    statusLabel = 'Storm Outage';
    statusClass = 'storm';
  } else if (isPaused) {
    statusLabel = 'Vessel Docked (Paused)';
    statusClass = 'paused';
  }

  return (
    <div>
      <div className="stars-auth" aria-hidden="true"></div>
      <div className="star star-1" aria-hidden="true"></div>
      <div className="star star-2" aria-hidden="true"></div>
      <div className="star star-3" aria-hidden="true"></div>
      <div className="star star-4" aria-hidden="true"></div>
      <div className="star star-5" aria-hidden="true"></div>
      <div className="star star-6" aria-hidden="true"></div>

      <div className="rope left" aria-hidden="true"></div>
      <div className="rope right" aria-hidden="true"></div>

      <header className="topnav">
        <div className="brand">
          <Link href="/">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="brand-svg">
              <path d="M16 36h8l-1-6h-6z" fill="currentColor" opacity=".5"/>
              <path d="M14 30h12l-2-18h-8z" fill="currentColor"/>
              <rect x="15" y="18" width="10" height="3" fill="var(--lh-red)"/>
              <rect x="16" y="11" width="8" height="6" fill="currentColor" opacity=".5"/>
              <path d="M14 11l6-7 6 7z" fill="var(--lh-red)"/>
            </svg>
            BEACON
          </Link>
        </div>
        <nav className="nav-links">
          <Link href="/auth/login" className="signup signup--ghost">
            Harbor Sign In
          </Link>
        </nav>
      </header>

      {/* Lighthouse with sweeping beam */}
      <div className="scene">
        <div className="beam-pivot" aria-hidden="true">
          <div className="beam"></div>
        </div>
        <svg className="lighthouse" viewBox="0 0 150 200" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lighthouse with a slowly sweeping beam">
          <ellipse cx="75" cy="190" rx="60" ry="10" fill="#0c2233" opacity=".6"/>
          <path d="M50 175 L65 90 L85 90 L100 175 Z" fill="var(--lh-white)"/>
          <rect x="58" y="150" width="34" height="11" fill="var(--lh-red)"/>
          <rect x="61" y="123" width="28" height="11" fill="var(--lh-red)"/>
          <rect x="64" y="96" width="22" height="11" fill="var(--lh-red)"/>
          <rect x="55" y="84" width="40" height="7" fill="#2c3e30"/>
          <rect x="62" y="55" width="26" height="30" fill="#0d2236" stroke="var(--lh-white)" strokeWidth="3"/>
          <path d="M62 55 L75 36 L88 55 Z" fill="var(--lh-red)"/>
          <circle cx="75" cy="70" r="7" fill="var(--beam)"/>
        </svg>
      </div>

      <main className="auth-stage">
        <section className="auth-card auth-card--wide">
          <h1>{statusData.name}</h1>
          <p className="subtitle">Public Vessel Status Deck</p>

          <div className="status-badge-wrap">
            <div className={`stage-card ${statusClass} stage-card--light`}>
              <div className="stage-icon stage-icon--lg">
                {isUp && (
                  <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull text-calm"/>
                    <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull text-calm" opacity=".7"/>
                    <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull text-calm" opacity=".4"/>
                    <path d="M12 44h40l-5 9H17z" fill="var(--rope-dark)"/>
                    <path d="M6 50c4-2 8-2 12 0s8 2 12 0 8-2 12 0 8 2 12 0" stroke="rgba(95,174,110,.4)" strokeWidth="2" fill="none"/>
                  </svg>
                )}
                {isDegraded && (
                  <svg className="ship-bob ship-bob--rough" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull text-rough"/>
                    <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull text-rough" opacity=".7"/>
                    <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull text-rough" opacity=".4"/>
                    <path d="M12 44h40l-5 9H17z" fill="var(--rope-dark)"/>
                    <path d="M4 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="rgba(224,162,60,.5)" strokeWidth="2.5" fill="none"/>
                  </svg>
                )}
                {isDown && (
                  <svg className="ship-bob ship-bob--storm" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull text-storm"/>
                    <path d="M32 44h-12l4-9h8z" fill="currentColor" className="ship-hull text-storm" opacity=".7"/>
                    <path d="M32 44h12l-4-9h-8z" fill="currentColor" className="ship-hull text-storm" opacity=".4"/>
                    <text x="32" y="22" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="9" fill="var(--storm)" className="sos-flash">SOS</text>
                    <path d="M14 6l3 5-4 1 4 5" stroke="var(--rough)" strokeWidth="2" fill="none" strokeLinecap="round" className="sos-flash"/>
                    <path d="M50 6l3 5-4 1 4 5" stroke="var(--rough)" strokeWidth="2" fill="none" strokeLinecap="round" className="sos-flash"/>
                    <path d="M4 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="rgba(217,83,79,.55)" strokeWidth="2.5" fill="none"/>
                  </svg>
                )}
                {isPaused && (
                  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 20v34" stroke="currentColor" strokeWidth="3" className="text-ink-soft"/>
                    <path d="M50 20 L62 30 L50 30 Z" fill="currentColor" className="text-ink-soft"/>
                    <rect x="46" y="30" width="8" height="8" fill="#0d2236" stroke="currentColor" className="text-ink-soft"/>
                    <line x1="14" y1="40" x2="32" y2="40" stroke="currentColor" strokeWidth="2" className="text-ink-soft"/>
                    <path d="M14 40 L26 30 L32 40 Z" fill="currentColor" opacity=".6" className="text-ink-soft"/>
                    <path d="M6 50h52l-4 7H10z" fill="var(--rope-dark)"/>
                  </svg>
                )}
              </div>
              <p className="stage-sub">Current State</p>
              <h3>{statusLabel}</h3>
            </div>
          </div>

          <div className="uptime-grid">
            <div>
              <span className="uptime-label">7-Day Uptime Mastery</span>
              <p className="uptime-value">
                {statusData.uptimePercent7d.toFixed(2)}%
              </p>
              <div className="stat-bar stat-bar--status">
                <span 
                  className={`h-full block transition-all duration-500 ${
                    statusData.uptimePercent7d > 98 
                      ? 'bg-calm' 
                      : statusData.uptimePercent7d > 90 
                        ? 'bg-rough' 
                        : 'bg-storm'
                  }`}
                  style={{ width: `${statusData.uptimePercent7d}%` }}
                ></span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="incidents-section-heading">
              Recent Outage Incidents
            </h3>
            
            {statusData.incidents.length === 0 ? (
              <p className="table-empty-text text-center py-6">
                No storm outages recorded in the current log window.
              </p>
            ) : (
              <div className="incidents-scroll">
                {statusData.incidents.map((incident) => (
                  <div key={incident.id} className="incident-row">
                    <div>
                      <div className="incident-row-title">Storm Outage</div>
                      <div className="incident-row-date">
                        {new Date(incident.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="incident-row-right">
                      <span className={`status-pill on-parchment status-pill--xs ${incident.resolvedAt ? 'green' : 'red'}`}>
                        {incident.resolvedAt ? 'Resolved' : 'Active Outage'}
                      </span>
                      <div className="incident-row-duration">
                        {incident.durationSeconds 
                          ? `${Math.round(incident.durationSeconds / 60)}m (${incident.durationSeconds}s)` 
                          : incident.resolvedAt ? '< 1m' : 'Ongoing'
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="links-below links-below--bordered">
            <p>Commissioned under BEACON Watchtower fleet operations.</p>
            <p><Link href="/">Go to Beacon Main Deck</Link></p>
          </div>
        </section>
      </main>

      <footer className="harbor-footer harbor-footer--spaced" aria-hidden="true">
        <div className="ship-wrap">
          <svg width="160" height="100" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 70h140l-14 22H24z" fill="#caa86a"/>
            <line x1="80" y1="70" x2="80" y2="14" stroke="#caa86a" strokeWidth="3"/>
            <path d="M81 18 L122 64 H81 Z" fill="#e6d3a4" opacity=".85"/>
            <path d="M79 26 L50 64 H79 Z" fill="#f3e8cb" opacity=".7"/>
            <g stroke="var(--lh-red)" strokeWidth="4" strokeLinecap="round">
              <line x1="96" y1="30" x2="112" y2="46"/>
              <line x1="112" y1="30" x2="96" y2="46"/>
            </g>
          </svg>
        </div>

        <div className="compass-wrap">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" stroke="var(--gold)" strokeWidth="1.5" opacity=".6"/>
            <circle cx="60" cy="60" r="36" stroke="var(--gold)" strokeWidth="1" opacity=".35"/>
            <g className="compass-needle">
              <path d="M60 24 L68 60 L60 96 L52 60 Z" fill="var(--gold)" opacity=".8"/>
              <path d="M60 24 L68 60 L60 60 Z" fill="var(--lh-red)"/>
            </g>
            <text x="60" y="14" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">N</text>
            <text x="60" y="112" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">S</text>
            <text x="8" y="64" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">W</text>
            <text x="112" y="64" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">E</text>
          </svg>
        </div>

        <div className="ship-wrap ship-wrap--mirrored">
          <svg width="160" height="100" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 70h140l-14 22H24z" fill="#caa86a"/>
            <line x1="80" y1="70" x2="80" y2="14" stroke="#caa86a" strokeWidth="3"/>
            <path d="M81 18 L122 64 H81 Z" fill="#e6d3a4" opacity=".85"/>
            <path d="M79 26 L50 64 H79 Z" fill="#f3e8cb" opacity=".7"/>
          </svg>
        </div>
      </footer>
    </div>
  );
}
