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
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-deep)',
        color: 'var(--parchment)',
        fontFamily: 'Fraunces, Georgia, serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Scanning the horizon...</h2>
          <div className="skeleton" style={{ width: '120px', height: '4px', margin: '1rem auto' }}></div>
        </div>
      </div>
    );
  }

  if (error && !statusData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="stars-auth" aria-hidden="true"></div>
        <header className="topnav">
          <div className="brand">
            <Link href="/">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle', width: '26px', height: '26px' }}>
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
        <main className="auth-stage" style={{ marginTop: '2rem', zIndex: 10 }}>
          <section className="auth-card" style={{ textAlign: 'center' }}>
            <svg style={{ margin: '0 auto 1rem', color: 'var(--storm)' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <h1 style={{ fontSize: '1.4rem' }}>Lighthouse Beacon Lost</h1>
            <p className="subtitle" style={{ color: 'var(--ink-soft)' }}>{error}</p>
            <Link href="/" className="enter-btn" style={{ textDecoration: 'none', display: 'flex', marginTop: '1.5rem' }}>
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
      <div className="star" style={{ top: '9%', left: '30%', animationDelay: '0s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '16%', left: '70%', animationDelay: '.8s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '6%', left: '55%', animationDelay: '1.6s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '24%', left: '12%', animationDelay: '2.4s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '20%', left: '88%', animationDelay: '1.1s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '30%', left: '46%', animationDelay: '.4s' }} aria-hidden="true"></div>

      <div className="rope left" aria-hidden="true"></div>
      <div className="rope right" aria-hidden="true"></div>

      <header className="topnav">
        <div className="brand">
          <Link href="/">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle', width: '26px', height: '26px' }}>
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
          <Link href="/auth/login" className="signup" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
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
          <rect x="62" y="55" width="26" height="30" fill="#0d2236" stroke="var(--lh-white)" stroke-width="3"/>
          <path d="M62 55 L75 36 L88 55 Z" fill="var(--lh-red)"/>
          <circle cx="75" cy="70" r="7" fill="var(--beam)"/>
        </svg>
      </div>

      <main className="auth-stage">
        <section className="auth-card" style={{ maxWidth: '520px' }}>
          <h1>{statusData.name}</h1>
          <p className="subtitle">Public Vessel Status Deck</p>

          <div style={{ textAlign: 'center', margin: '2rem 0 1.5rem' }}>
            <div className={`stage-card ${statusClass}`} style={{ background: 'rgba(58, 44, 24, 0.04)', border: '1px solid rgba(110, 90, 60, 0.15)' }}>
              <div className="stage-icon" style={{ width: '80px', height: '80px' }}>
                {isUp && (
                  <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull" style={{ color: 'var(--calm)' }}/>
                    <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull" opacity=".7" style={{ color: 'var(--calm)' }}/>
                    <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull" opacity=".4" style={{ color: 'var(--calm)' }}/>
                    <path d="M12 44h40l-5 9H17z" fill="var(--rope-dark)"/>
                    <path d="M6 50c4-2 8-2 12 0s8 2 12 0 8-2 12 0 8 2 12 0" stroke="rgba(95,174,110,.4)" strokeWidth="2" fill="none"/>
                  </svg>
                )}
                {isDegraded && (
                  <svg className="ship-bob" style={{ animationDuration: '2.4s' }} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull" style={{ color: 'var(--rough)' }}/>
                    <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull" opacity=".7" style={{ color: 'var(--rough)' }}/>
                    <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull" opacity=".4" style={{ color: 'var(--rough)' }}/>
                    <path d="M12 44h40l-5 9H17z" fill="var(--rope-dark)"/>
                    <path d="M4 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="rgba(224,162,60,.5)" strokeWidth="2.5" fill="none"/>
                  </svg>
                )}
                {isDown && (
                  <svg className="ship-bob" style={{ animationName: 'bob-storm', animationDuration: '1.4s' }} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull" style={{ color: 'var(--storm)' }}/>
                    <path d="M32 44h-12l4-9h8z" fill="currentColor" className="ship-hull" opacity=".7" style={{ color: 'var(--storm)' }}/>
                    <path d="M32 44h12l-4-9h-8z" fill="currentColor" className="ship-hull" opacity=".4" style={{ color: 'var(--storm)' }}/>
                    <text x="32" y="22" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="9" fill="var(--storm)" className="sos-flash">SOS</text>
                    <path d="M14 6l3 5-4 1 4 5" stroke="var(--rough)" strokeWidth="2" fill="none" strokeLinecap="round" className="sos-flash"/>
                    <path d="M50 6l3 5-4 1 4 5" stroke="var(--rough)" strokeWidth="2" fill="none" strokeLinecap="round" className="sos-flash"/>
                    <path d="M4 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="rgba(217,83,79,.55)" strokeWidth="2.5" fill="none"/>
                  </svg>
                )}
                {isPaused && (
                  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 20v34" stroke="currentColor" strokeWidth="3" style={{ color: 'var(--ink-soft)' }}/>
                    <path d="M50 20 L62 30 L50 30 Z" fill="var(--ink-soft)"/>
                    <rect x="46" y="30" width="8" height="8" fill="#0d2236" stroke="currentColor" style={{ color: 'var(--ink-soft)' }}/>
                    <line x1="14" y1="40" x2="32" y2="40" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ink-soft)' }}/>
                    <path d="M14 40 L26 30 L32 40 Z" fill="currentColor" opacity=".6" style={{ color: 'var(--ink-soft)' }}/>
                    <path d="M6 50h52l-4 7H10z" fill="var(--rope-dark)"/>
                  </svg>
                )}
              </div>
              <p className="stage-sub" style={{ margin: '0.2rem 0 0.4rem' }}>Current State</p>
              <h3 style={{ fontSize: '1.25rem' }}>{statusLabel}</h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(58, 44, 24, 0.04)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(110, 90, 60, 0.1)' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--ink-soft)', letterSpacing: '0.08em', fontWeight: 600 }}>7-Day Uptime Mastery</span>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.25rem 0', fontFamily: 'var(--ff-mono, JetBrains Mono, monospace)' }}>
                {statusData.uptimePercent7d.toFixed(2)}%
              </p>
              <div className="stat-bar" style={{ background: 'rgba(58, 44, 24, 0.15)', height: '6px', maxWidth: '240px', margin: '0.5rem auto 0' }}>
                <span style={{ 
                  width: `${statusData.uptimePercent7d}%`, 
                  backgroundColor: statusData.uptimePercent7d > 98 ? 'var(--calm)' : statusData.uptimePercent7d > 90 ? 'var(--rough)' : 'var(--storm)',
                  height: '100%',
                  display: 'block'
                }}></span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--ff-display, Fraunces, Georgia, serif)', fontSize: '1rem', letterSpacing: '0.02em', borderBottom: '1px solid rgba(110, 90, 60, 0.15)', paddingBottom: '0.4rem', color: 'var(--ink)', fontWeight: 700 }}>
              Recent Outage Incidents
            </h3>
            
            {statusData.incidents.length === 0 ? (
              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--ink-soft)', padding: '1.5rem 0' }}>
                No storm outages recorded in the current log window.
              </p>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {statusData.incidents.map((incident) => (
                  <div key={incident.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(110, 90, 60, 0.08)', fontSize: '0.8rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Storm Outage</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--ink-soft)' }}>
                        {new Date(incident.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`status-pill on-parchment ${incident.resolvedAt ? 'green' : 'red'}`} style={{ fontSize: '0.65rem' }}>
                        {incident.resolvedAt ? 'Resolved' : 'Active Outage'}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--ink-soft)', marginTop: '0.15rem' }}>
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

          <div className="links-below" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(110, 90, 60, 0.15)', paddingTop: '1rem' }}>
            <p>Commissioned under BEACON Watchtower fleet operations.</p>
            <p><Link href="/">Go to Beacon Main Deck</Link></p>
          </div>
        </section>
      </main>

      <footer className="harbor-footer" aria-hidden="true" style={{ marginTop: '4rem' }}>
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
            <text x="60" y="14" text-anchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">N</text>
            <text x="60" y="112" text-anchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">S</text>
            <text x="8" y="64" text-anchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">W</text>
            <text x="112" y="64" text-anchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fill="var(--parchment)">E</text>
          </svg>
        </div>

        <div className="ship-wrap" style={{ transform: 'scaleX(-1)' }}>
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
