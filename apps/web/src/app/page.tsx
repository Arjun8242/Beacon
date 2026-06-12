'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../lib/api';

export default function Home() {
  const [isAuth, setIsAuth] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check auth status
      if (api.isAuthenticated()) {
        setIsAuth(true);
        api.getMe()
          .then((data) => {
            setUserEmail(data.user.email);
          })
          .catch((err) => {
            console.error('Failed to authenticate token:', err);
            api.clearToken();
            setIsAuth(false);
          });
      }

      // Scroll observer
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in-view');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2 }
      );

      document.querySelectorAll('.stage-card, .panel').forEach((el) => {
        observer.observe(el);
      });

      return () => observer.disconnect();
    }
  }, []);

  const handleSignOut = () => {
    api.clearToken();
    setIsAuth(false);
    setUserEmail(null);
    window.location.reload();
  };

  // CTA click alert no longer needed as dashboard is ready

  return (
    <div>
      <div className="stars" aria-hidden="true"></div>
      <div className="star" style={{ top: '5%', left: '34%', animationDelay: '0s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '11%', left: '62%', animationDelay: '.9s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '3%', left: '50%', animationDelay: '1.8s' }} aria-hidden="true"></div>
      <div className="star" style={{ top: '18%', left: '8%', animationDelay: '2.5s' }} aria-hidden="true"></div>

      <div className="wrap">
        <header className="nav">
          <div className="brand">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M16 36h8l-1-6h-6z" fill="currentColor" opacity=".5"/>
              <path d="M14 30h12l-2-18h-8z" fill="currentColor"/>
              <rect x="15" y="18" width="10" height="3" fill="var(--lh-red)"/>
              <rect x="16" y="11" width="8" height="6" fill="currentColor" opacity=".5"/>
              <path d="M14 11l6-7 6 7z" fill="var(--lh-red)"/>
            </svg>
            BEACON
          </div>
          <nav className="nav-links">
            <a href="#journey">Live status</a>
            <a href="#intel">Pricing</a>
            {isAuth ? (
              <>
                <span style={{ color: 'var(--gold)', fontSize: '0.88rem' }}>Welcome, {userEmail || 'Captain'}</span>
                <Link href="/dashboard" style={{ color: 'var(--beacon-green-bright)', fontWeight: 600 }}>Harbor Dashboard</Link>
                <button
                  onClick={handleSignOut}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    cursor: 'pointer',
                    opacity: 0.82,
                    padding: 0,
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login">Sign in</Link>
                <Link href="/auth/register" className="nav-cta">Deploy the Beacon</Link>
              </>
            )}
          </nav>
        </header>

        {/* ===== Hero ===== */}
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">— Beacon uptime · the watchtower</p>
            <h1>Infrastructure<br />as ocean.</h1>
            <p className="lead">Know your fleet, before the storm. Beacon watches every vessel in your stack and signals the moment the water turns rough.</p>
            <div className="hero-actions">
              <Link href={isAuth ? '/dashboard' : '/auth/register'} className="btn-primary">
                <span className="wheel-svg" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="30" cy="30" r="21" stroke="currentColor" stroke-width="3"/>
                    <circle cx="30" cy="30" r="5" fill="currentColor"/>
                    <g stroke="currentColor" stroke-width="3" stroke-linecap="round">
                      <line x1="30" y1="9" x2="30" y2="51"/>
                      <line x1="9" y1="30" x2="51" y2="30"/>
                      <line x1="15" y1="15" x2="45" y2="45"/>
                      <line x1="45" y1="15" x2="15" y2="45"/>
                    </g>
                  </svg>
                </span>
                Deploy the Beacon
              </Link>
              <a href="#journey" className="btn-text">Explore live fleet</a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="radar-grid" aria-hidden="true"></div>

            <div className="beam-pivot" aria-hidden="true">
              <div className="beam"></div>
            </div>
            <svg className="hero-lighthouse" viewBox="0 0 150 200" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lighthouse with a slowly sweeping beam">
              <path d="M50 175 L65 90 L85 90 L100 175 Z" fill="var(--lh-white)"/>
              <rect x="58" y="150" width="34" height="11" fill="var(--lh-red)"/>
              <rect x="61" y="123" width="28" height="11" fill="var(--lh-red)"/>
              <rect x="64" y="96" width="22" height="11" fill="var(--lh-red)"/>
              <rect x="55" y="84" width="40" height="7" fill="#2c3e30"/>
              <rect x="62" y="55" width="26" height="30" fill="#0d2236" stroke="var(--lh-white)" stroke-width="3"/>
              <path d="M62 55 L75 36 L88 55 Z" fill="var(--lh-red)"/>
              <circle cx="75" cy="70" r="7" fill="var(--beam)"/>
            </svg>

            <div className="radar-circle" aria-hidden="true">
              <div className="radar-sweep"></div>
              <div className="radar-blip" style={{ top: '30%', left: '40%', animationDelay: '0s' }}></div>
              <div className="radar-blip" style={{ top: '55%', left: '65%', animationDelay: '.6s' }}></div>
              <div className="radar-blip" style={{ top: '68%', left: '35%', animationDelay: '1.2s' }}></div>
              <div className="radar-blip" style={{ top: '42%', left: '55%', animationDelay: '1.8s' }}></div>
            </div>

            <div className="watchtower-card">
              <p className="wt-title">Beacon uptime — the watchtower</p>
              <p className="wt-sub">Fleet overview · total vessel connections: 15</p>
            </div>
          </div>
        </section>

        {/* ===== Journey ===== */}
        <section className="journey" id="journey">
          <div className="section-head">
            <p className="eyebrow">Know your fleet, before the storm</p>
            <h2>Four stages of a voyage</h2>
            <p>Every vessel in your fleet moves through the same waters. Beacon tells you exactly which stage it's in, in real time.</p>
          </div>

          <div className="journey-track">
            <article className="stage-card calm">
              <div className="stage-icon">
                <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull"/>
                  <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull" opacity=".7"/>
                  <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull" opacity=".4"/>
                  <path d="M12 44h40l-5 9H17z" fill="var(--gold)"/>
                  <path d="M6 50c4-2 8-2 12 0s8 2 12 0 8-2 12 0 8 2 12 0" stroke="rgba(201,163,92,.4)" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <p className="stage-sub">Calm seas</p>
              <h3>Healthy services</h3>
              <p>Stable vessels reporting green across the entire fleet.</p>
            </article>

            <div className="connector"><span className="signal"></span></div>

            <article className="stage-card rough">
              <div className="stage-icon">
                <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull"/>
                  <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull" opacity=".7"/>
                  <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull" opacity=".4"/>
                  <path d="M12 44h40l-5 9H17z" fill="var(--gold)"/>
                  <path d="M4 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="rgba(224,162,60,.5)" strokeWidth="2.5" fill="none"/>
                </svg>
              </div>
              <p className="stage-sub">Rough waters</p>
              <h3>Degraded performance</h3>
              <p>Weak signals ripple through a handful of vessels.</p>
            </article>

            <div className="connector"><span className="signal"></span></div>

            <article className="stage-card storm">
              <div className="stage-icon">
                <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull"/>
                  <path d="M32 44h-12l4-9h8z" fill="currentColor" className="ship-hull" opacity=".7"/>
                  <path d="M32 44h12l-4-9h-8z" fill="currentColor" className="ship-hull" opacity=".4"/>
                  <text x="32" y="22" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="9" fill="var(--storm)" className="sos-flash">SOS</text>
                  <path d="M14 6l3 5-4 1 4 5" stroke="var(--rough)" strokeWidth="2" fill="none" strokeLinecap="round" className="sos-flash"/>
                  <path d="M50 6l3 5-4 1 4 5" stroke="var(--rough)" strokeWidth="2" fill="none" strokeLinecap="round" className="sos-flash"/>
                  <path d="M4 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="rgba(217,83,79,.55)" strokeWidth="2.5" fill="none"/>
                </svg>
              </div>
              <p className="stage-sub">Storm warning</p>
              <h3>Service failure</h3>
              <p>Broken connections raise the SOS flag fleet-wide.</p>
            </article>

            <div className="connector"><span className="signal"></span></div>

            <article className="stage-card harbor">
              <div className="stage-icon">
                <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 20v34" stroke="currentColor" strokeWidth="3" className="ship-hull"/>
                  <path d="M50 20 L62 30 L50 30 Z" fill="var(--lh-red)"/>
                  <rect x="46" y="30" width="8" height="8" fill="#0d2236" stroke="currentColor" className="ship-hull"/>
                  <line x1="14" y1="40" x2="32" y2="40" stroke="currentColor" strokeWidth="2" className="ship-hull"/>
                  <path d="M14 40 L26 30 L32 40 Z" fill="currentColor" className="ship-hull" opacity=".6"/>
                  <path d="M6 50h52l-4 7H10z" fill="var(--gold)"/>
                </svg>
              </div>
              <p className="stage-sub">Safe harbor</p>
              <h3>Incident resolution</h3>
              <p>Recovery brings the fleet home — MTTR under 30 minutes.</p>
            </article>
          </div>
        </section>

        {/* ===== Intelligence panels ===== */}
        <section className="intel" id="intel">
          <div className="section-head">
            <p className="eyebrow">Charted from the watchtower</p>
            <h2>Fleet intelligence, in plain sight</h2>
            <p>Three views Beacon keeps on deck at all times — where the storms are, how fast the fleet responds, and how the harbor is holding up.</p>
          </div>

          <div className="intel-grid">
            <article className="panel">
              <h3>Storm systems tracking</h3>
              <div className="panel-visual">
                <div className="storm-dot-grid" aria-hidden="true"></div>
                <div className="storm-cell" style={{ top: '18px', left: '60px' }}></div>
                <div className="storm-cell delay" style={{ top: '60px', left: '190px' }}></div>
                <div className="storm-label" style={{ top: '8px', left: '64px' }}>P1</div>
                <div className="storm-label" style={{ top: '50px', left: '194px' }}>P2</div>
              </div>
              <p className="panel-caption">Incident timeline · major storm (P1) · 12:35–13:05 GMT</p>
            </article>

            <article className="panel">
              <h3>Fleet response times</h3>
              <div className="panel-visual">
                <svg className="chart-svg" viewBox="0 0 400 140" preserveAspectRatio="none">
                  <line x1="0" y1="35" x2="400" y2="35" stroke="rgba(201,163,92,.18)" strokeWidth="1"/>
                  <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(201,163,92,.18)" strokeWidth="1"/>
                  <line x1="0" y1="105" x2="400" y2="105" stroke="rgba(201,163,92,.18)" strokeWidth="1"/>
                  <rect x="190" y="0" width="70" height="140" fill="rgba(217,83,79,.18)"/>
                  <path d="M0,95 C40,88 60,98 90,90 C120,82 140,94 170,86 C200,78 215,28 240,18 C260,10 280,46 310,84 C340,108 370,98 400,90"
                        fill="none" stroke="var(--harbor)" strokeWidth="2.5"/>
                  <text x="232" y="30" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="600" fill="var(--lh-red)">500ms</text>
                  <text x="6" y="132" fontFamily="Inter, sans-serif" fontSize="9" fill="rgba(201,163,92,.7)">avg 243ms</text>
                </svg>
                <div className="chart-scan" aria-hidden="true"></div>
              </div>
              <p className="panel-caption">Average response 243ms · storm peak 500ms</p>
            </article>

            <article className="panel">
              <h3>Uptime harbor mastery</h3>
              <div className="panel-visual">
                <svg className="chart-svg" viewBox="0 0 220 140" preserveAspectRatio="none">
                  <rect x="30" y="30" width="160" height="80" fill="#13314a"/>
                  <path d="M30,110 L30,30 L190,30 L190,90" fill="none" stroke="var(--calm)" strokeWidth="6" strokeLinecap="round"/>
                  <path d="M150,30 L190,30 L190,60" fill="none" stroke="var(--storm)" strokeWidth="6" strokeLinecap="round"/>
                  <rect x="60" y="14" width="12" height="14" fill="var(--gold)"/>
                  <rect x="95" y="14" width="12" height="14" fill="var(--gold)"/>
                  <rect x="130" y="14" width="12" height="14" fill="var(--gold)"/>
                </svg>
                <svg className="harbor-boat" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 17h18l-2 4H5z"/>
                  <path d="M12 17V6l6 6z"/>
                </svg>
              </div>
              <p className="panel-caption">Fleet uptime 99.3% · harbor health</p>
            </article>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="cta" id="cta">
          <h2>Deploy the Beacon</h2>
          <p>Stand watch over every vessel in your stack — set up takes minutes.</p>
          <Link href={isAuth ? '/dashboard' : '/auth/register'} className="btn-primary">
            <span className="wheel-svg" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="30" cy="30" r="21" stroke="currentColor" stroke-width="3"/>
                <circle cx="30" cy="30" r="5" fill="currentColor"/>
                <g stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="30" y1="9" x2="30" y2="51"/>
                  <line x1="9" y1="30" x2="51" y2="30"/>
                  <line x1="15" y1="15" x2="45" y2="45"/>
                  <line x1="45" y1="15" x2="15" y2="45"/>
                </g>
                <g fill="currentColor">
                  <circle cx="30" cy="7" r="2.6"/><circle cx="30" cy="53" r="2.6"/>
                  <circle cx="7" cy="30" r="2.6"/><circle cx="53" cy="30" r="2.6"/>
                  <circle cx="13" cy="13" r="2.6"/><circle cx="47" cy="47" r="2.6"/>
                  <circle cx="47" cy="13" r="2.6"/><circle cx="13" cy="47" r="2.6"/>
                </g>
              </svg>
            </span>
            Deploy the Beacon
          </Link>
        </section>
      </div>

      <footer className="site-footer">
        <div className="wrap">Beacon · Know your fleet, before the storm.</div>
      </footer>
    </div>
  );
}
