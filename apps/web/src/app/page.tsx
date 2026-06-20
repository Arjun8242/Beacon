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

      document.querySelectorAll('.stage, .panel, .story-panel, .browser-frame, .arch-diagram-wrap, .arch-card').forEach((el) => {
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

  return (
    <div>


  <div className="stars" aria-hidden="true"></div>
  <div className="star star-home-1" aria-hidden="true"></div>
  <div className="star star-home-2" aria-hidden="true"></div>
  <div className="star star-home-3" aria-hidden="true"></div>
  <div className="star star-home-4" aria-hidden="true"></div>

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
            <a href="#why">Why Beacon</a>
            <a href="#product">Product</a>
            <a href="#architecture">Architecture</a>
            <a href="#intel">Pricing</a>
            {isAuth ? (
              <>
                <span className="text-gold text-[0.88rem]">Welcome, {userEmail || 'Captain'}</span>
                <Link href="/dashboard" className="text-beacon-green-bright font-semibold">Harbor Dashboard</Link>
                <button
                  onClick={handleSignOut}
                  className="btn-signout"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login">Sign in</Link>
                <Link href="/auth/register" className="nav-cta">Get started</Link>
              </>
            )}
          </nav>

    </header>

    {/*  ===== Hero =====  */}
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">— Real-time status for your AI stack</p>
        <h1>Monitor every service
<br />your business depends on.</h1>
        <p className="lead">Beacon continuously monitors the AI apps and APIs your product depends on — Claude, ChatGPT, Gemini, and more — and alerts you the moment latency rises or a service goes down.</p>
        <div className="hero-actions">
          <Link href={isAuth ? "/dashboard" : "/auth/register"} className="btn-primary">
            <span className="wheel-svg" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="30" cy="30" r="21" stroke="currentColor" strokeWidth="3"/>
                <circle cx="30" cy="30" r="5" fill="currentColor"/>
                <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="30" y1="9" x2="30" y2="51"/>
                  <line x1="9" y1="30" x2="51" y2="30"/>
                  <line x1="15" y1="15" x2="45" y2="45"/>
                  <line x1="45" y1="15" x2="15" y2="45"/>
                </g>
              </svg>
            </span>
            Get started
          </Link>
          <a href="#journey" className="btn-text">See how it works</a>
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
          <rect x="62" y="55" width="26" height="30" fill="#0d2236" stroke="var(--lh-white)" strokeWidth="3"/>
          <path d="M62 55 L75 36 L88 55 Z" fill="var(--lh-red)"/>
          <circle cx="75" cy="70" r="7" fill="var(--beam)"/>
        </svg>

        <div className="radar-circle" aria-hidden="true">
          <div className="radar-sweep"></div>
          <div className="radar-blip radar-blip-1"></div>
          <div className="radar-blip radar-blip-2"></div>
          <div className="radar-blip radar-blip-3"></div>
          <div className="radar-blip radar-blip-4"></div>
        </div>

        <div className="watchtower-card">
          <p className="wt-title">Beacon status board</p>
          <p className="wt-sub">Now monitoring 15 connected services</p>
        </div>
      </div>
    </section>

    {/*  ===== Why Beacon (story) =====  */}
    <section className="story" id="why">
      <div className="section-head">
        <p className="eyebrow">Why "Beacon"?</p>
        <h2>Inspired by how lighthouses guide ships through storms.</h2>
      </div>
      <div className="story-grid">
        <article className="story-panel">
          <div className="story-visual lighthouse-visual">
            <div className="story-beam-pivot" aria-hidden="true"><div className="story-beam"></div></div>
            <svg viewBox="0 0 150 200" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lighthouse scanning the sea with a sweeping beam">
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
          <h3>The Lighthouse</h3>
          <p>A lighthouse doesn't prevent storms — it watches the horizon and warns ships before danger arrives. Beacon does the same for your websites, APIs, and services.</p>
        </article>

        <article className="story-panel">
          <div className="story-visual">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Storm clouds approaching a ship">
              <line x1="6" y1="74" x2="94" y2="74" stroke="rgba(58,44,24,.2)" strokeWidth="2"/>
              <g>
                <line x1="34" y1="42" x2="34" y2="70" stroke="var(--rough)" strokeWidth="3"/>
                <path d="M34 44 L52 58 L34 58 Z" fill="var(--rough)" opacity=".7"/>
                <path d="M20 70h28l-3 7H23z" fill="var(--gold)"/>
              </g>
              <g className="story-clouds" fill="var(--storm)" opacity=".55">
                <ellipse cx="76" cy="26" rx="17" ry="10"/>
                <ellipse cx="62" cy="30" rx="12" ry="8"/>
                <ellipse cx="88" cy="32" rx="10" ry="7"/>
              </g>
            </svg>
          </div>
          <h3>The Storm</h3>
          <p>Small signals become major incidents. A slow API response today can become tomorrow's outage. Beacon catches latency spikes and failures before they reach your users.</p>
        </article>

        <article className="story-panel">
          <div className="story-visual">
            <svg className="ship-bob text-harbor" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ship returning to harbor after a storm">
              <path d="M50 20v34" stroke="currentColor" strokeWidth="3"/>
              <path d="M50 20 L62 30 L50 30 Z" fill="var(--lh-red)"/>
              <rect x="46" y="30" width="8" height="8" fill="#0d2236" stroke="currentColor"/>
              <line x1="14" y1="40" x2="32" y2="40" stroke="currentColor" strokeWidth="2"/>
              <path d="M14 40 L26 30 L32 40 Z" fill="currentColor" opacity=".6"/>
              <path d="M6 50h52l-4 7H10z" fill="var(--gold)"/>
            </svg>
          </div>
          <h3>Safe Harbor</h3>
          <p>Every incident tells a story. Beacon tracks the full lifecycle — from healthy operation to failure and recovery — so your team knows exactly what happened and how fast you responded.</p>
        </article>
      </div>
    </section>

    {/*  ===== Product screenshot =====  */}
    <section className="product-shot" id="product">
      <div className="section-head">
        <p className="eyebrow">See it in action</p>
        <h2>Your services, watched around the clock</h2>
      </div>
      <div className="browser-frame">
        <div className="browser-bar">
          <span className="traffic"></span><span className="traffic"></span><span className="traffic"></span>
          <span className="browser-url">app.beacon.dev/dashboard</span>
        </div>
        <div className="mini-dashboard">
          <div className="mini-sidebar" aria-hidden="true">
            <div className="mini-brand">BEACON</div>
            <div className="mini-nav-item active"></div>
            <div className="mini-nav-item"></div>
            <div className="mini-nav-item"></div>
            <div className="mini-nav-item"></div>
            <div className="mini-nav-item"></div>
          </div>
          <div className="mini-main">
            <p className="mini-heading">Service overview</p>
            <div className="mini-stats">
              <div className="mini-stat"><span className="mini-stat-value">34</span><span className="mini-stat-label">Operational</span></div>
              <div className="mini-stat"><span className="mini-stat-value">1</span><span className="mini-stat-label">Degraded</span></div>
              <div className="mini-stat"><span className="mini-stat-value">0</span><span className="mini-stat-label">Major outages</span></div>
              <div className="mini-stat"><span className="mini-stat-value">99.7%</span><span className="mini-stat-label">Uptime</span></div>
            </div>
            <div className="mini-grid">
              <div className="mini-card">
                <p className="mc-name">claude.ai</p>
                <div className="mc-meta"><span>44ms</span><span className="mini-pill green">Operational</span></div>
              </div>
              <div className="mini-card">
                <p className="mc-name">ChatGPT</p>
                <div className="mc-meta"><span>63ms</span><span className="mini-pill green">Operational</span></div>
              </div>
              <div className="mini-card degraded">
                <p className="mc-name">Mistral API</p>
                <div className="mc-meta"><span>119ms</span><span className="mini-pill red">Partial outage</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/*  ===== Architecture =====  */}
    <section className="architecture" id="architecture">
      <div className="section-head">
        <p className="eyebrow">Under the hood</p>
        <h2>Built like production infrastructure</h2>
        <p>Every check runs through the same pipeline — scheduled, queued, executed by independent workers, and pushed to your dashboard the moment something changes.</p>
      </div>

      <div className="arch-diagram-wrap">
        <svg className="arch-diagram" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture diagram: Monitor flows to Scheduler Service, to BullMQ Queue, fanning out to three Workers, merging into Incident Detection, then PostgreSQL and Redis, then the Realtime UI">
          <defs>
            <marker id="arch-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--gold)"/>
            </marker>
          </defs>

          {/*  connecting lines  */}
          <g stroke="rgba(201,163,92,.45)" strokeWidth="2">
            <line x1="300" y1="54" x2="300" y2="84" markerEnd="url(#arch-arrow)"/>
            <line x1="300" y1="134" x2="300" y2="164" markerEnd="url(#arch-arrow)"/>
            <line x1="300" y1="214" x2="300" y2="240"/>
            <line x1="100" y1="240" x2="500" y2="240"/>
            <line x1="100" y1="240" x2="100" y2="264" markerEnd="url(#arch-arrow)"/>
            <line x1="300" y1="240" x2="300" y2="264" markerEnd="url(#arch-arrow)"/>
            <line x1="500" y1="240" x2="500" y2="264" markerEnd="url(#arch-arrow)"/>
            <line x1="100" y1="314" x2="100" y2="340"/>
            <line x1="300" y1="314" x2="300" y2="340"/>
            <line x1="500" y1="314" x2="500" y2="340"/>
            <line x1="100" y1="340" x2="500" y2="340"/>
            <line x1="300" y1="340" x2="300" y2="364" markerEnd="url(#arch-arrow)"/>
            <line x1="300" y1="414" x2="300" y2="444" markerEnd="url(#arch-arrow)"/>
            <line x1="300" y1="494" x2="300" y2="524" markerEnd="url(#arch-arrow)"/>
          </g>

          {/*  Monitor  */}
          <rect x="220" y="10" width="160" height="44" rx="8" fill="#10243a" stroke="var(--gold)" strokeWidth="1.5"/>
          <text x="300" y="37" textAnchor="middle" className="arch-box-label">Monitor</text>

          {/*  Scheduler Service  */}
          <rect x="190" y="84" width="220" height="44" rx="8" fill="#10243a" stroke="rgba(201,163,92,.3)" strokeWidth="1.5"/>
          <text x="300" y="111" textAnchor="middle" className="arch-box-label">Scheduler Service</text>

          {/*  BullMQ Queue  */}
          <rect x="200" y="164" width="200" height="44" rx="8" fill="#10243a" stroke="rgba(201,163,92,.3)" strokeWidth="1.5"/>
          <text x="300" y="191" textAnchor="middle" className="arch-box-label">BullMQ Queue</text>

          {/*  Workers  */}
          <rect x="30" y="264" width="140" height="44" rx="8" fill="#10243a" stroke="rgba(95,174,110,.4)" strokeWidth="1.5"/>
          <text x="100" y="291" textAnchor="middle" className="arch-box-label">Worker 1</text>
          <rect x="30" y="264" width="140" height="44" rx="8" fill="#10243a" stroke="rgba(95,174,110,.4)" strokeWidth="1.5"/>
          <text x="300" y="291" textAnchor="middle" className="arch-box-label">Worker 2</text>
          <rect x="430" y="264" width="140" height="44" rx="8" fill="#10243a" stroke="rgba(95,174,110,.4)" strokeWidth="1.5"/>
          <text x="500" y="291" textAnchor="middle" className="arch-box-label">Worker 3</text>

          {/*  worker live indicators  */}
          <circle className="worker-ring" cx="158" cy="276" r="3" fill="none" stroke="var(--beacon-green-bright)" strokeWidth="1.5"/>
          <circle cx="158" cy="276" r="3" fill="var(--beacon-green-bright)"/>
          <circle className="worker-ring delay-1" cx="358" cy="276" r="3" fill="none" stroke="var(--beacon-green-bright)" strokeWidth="1.5"/>
          <circle cx="358" cy="276" r="3" fill="var(--beacon-green-bright)"/>
          <circle className="worker-ring delay-2" cx="558" cy="276" r="3" fill="none" stroke="var(--beacon-green-bright)" strokeWidth="1.5"/>
          <circle cx="558" cy="276" r="3" fill="var(--beacon-green-bright)"/>

          {/*  Incident Detection  */}
          <rect x="190" y="364" width="220" height="44" rx="8" fill="#10243a" stroke="rgba(224,162,60,.45)" strokeWidth="1.5"/>
          <text x="300" y="391" textAnchor="middle" className="arch-box-label">Incident Detection</text>

          {/*  PostgreSQL + Redis  */}
          <rect x="190" y="444" width="220" height="44" rx="8" fill="#10243a" stroke="rgba(70,179,168,.45)" strokeWidth="1.5"/>
          <text x="300" y="471" textAnchor="middle" className="arch-box-label">PostgreSQL + Redis</text>

          {/*  Realtime UI  */}
          <rect x="210" y="524" width="180" height="44" rx="8" fill="#10243a" stroke="var(--beacon-green)" strokeWidth="1.5"/>
          <text x="300" y="551" textAnchor="middle" className="arch-box-label fill-beacon-green-bright">Realtime UI</text>

          {/*  live data flow  */}
          <circle className="flow-packet" r="4" fill="var(--beam)"/>
          <circle className="flow-packet delay" r="4" fill="var(--beam)"/>
        </svg>
      </div>

      <div className="arch-grid">
        <article className="arch-card">
          <svg className="arch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="5" r="2.5"/>
            <circle cx="5" cy="19" r="2.5"/>
            <circle cx="19" cy="19" r="2.5"/>
            <path d="M12 7.5v4M12 11.5L6.5 16.5M12 11.5l5.5 5"/>
          </svg>
          <h3>Distributed workers</h3>
          <p>Multiple workers execute checks independently, so one slow check never blocks the rest of your fleet.</p>
        </article>

        <article className="arch-card">
          <svg className="arch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <h3>Intelligent incident detection</h3>
          <p>Beacon waits for consecutive failures before raising an incident, avoiding false positives from one-off blips.</p>
        </article>

        <article className="arch-card">
          <svg className="arch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
            <path d="M8.5 15.5a5 5 0 0 1 0-7"/>
            <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
            <path d="M5.5 18.5a9 9 0 0 1 0-13"/>
            <path d="M18.5 5.5a9 9 0 0 1 0 13"/>
          </svg>
          <h3>Realtime updates</h3>
          <p>Status changes are pushed to the dashboard instantly over WebSockets — no refresh needed.</p>
        </article>
      </div>
    </section>

    {/*  ===== Journey =====  */}
    <section className="journey" id="journey">
      <div className="section-head">
        <p className="eyebrow">From healthy to resolved</p>
        <h2>Four states every service moves through</h2>
        <p>Every API and app you monitor follows the same lifecycle. Beacon shows you exactly which state it's in, the moment it changes.</p>
      </div>

      <div className="journey-track">
        <article className="stage calm">
          <div className="stage-icon">
            <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull"/>
              <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull" opacity=".7"/>
              <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull" opacity=".4"/>
              <path d="M12 44h40l-5 9H17z" fill="var(--gold)"/>
              <path d="M6 50c4-2 8-2 12 0s8 2 12 0 8-2 12 0 8 2 12 0" stroke="rgba(201,163,92,.4)" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <p className="stage-sub">Operational</p>
          <h3>Healthy services</h3>
          <p>All monitored services are responding normally, with stable latency and uptime.</p>
        </article>

        <div className="connector"><span className="signal"></span></div>

        <article className="stage rough">
          <div className="stage-icon">
            <svg className="ship-bob" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="32" y1="8" x2="32" y2="44" stroke="currentColor" strokeWidth="2" className="ship-hull"/>
              <path d="M32 10 L48 24 L32 24 Z" fill="currentColor" className="ship-hull" opacity=".7"/>
              <path d="M32 14 L18 26 L32 26 Z" fill="currentColor" className="ship-hull" opacity=".4"/>
              <path d="M12 44h40l-5 9H17z" fill="var(--gold)"/>
              <path d="M4 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="rgba(224,162,60,.5)" strokeWidth="2.5" fill="none"/>
            </svg>
          </div>
          <p className="stage-sub">Degraded</p>
          <h3>Degraded performance</h3>
          <p>Response times slip or error rates climb on one or more services.</p>
        </article>

        <div className="connector"><span className="signal"></span></div>

        <article className="stage storm">
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
          <p className="stage-sub">Major outage</p>
          <h3>Service failure</h3>
          <p>A monitored service goes down, and Beacon flags it the moment it happens.</p>
        </article>

        <div className="connector"><span className="signal"></span></div>

        <article className="stage harbor">
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
          <p className="stage-sub">Resolved</p>
          <h3>Incident resolution</h3>
          <p>Service is back to normal and logged automatically — average resolution under 30 minutes.</p>
        </article>
      </div>
    </section>

    {/*  ===== Intelligence panels =====  */}
    <section className="intel" id="intel">
      <div className="section-head">
        <p className="eyebrow">Always-on visibility</p>
        <h2>Everything you need to know, at a glance</h2>
        <p>Three views Beacon keeps front and center — where outages are happening, how fast your services respond, and how reliable they've been over time.</p>
      </div>

      <div className="intel-grid">
        <article className="panel">
          <h3>Outage tracking</h3>
          <div className="panel-visual">
            <div className="storm-dot-grid" aria-hidden="true"></div>
            <div className="storm-cell storm-cell-1"></div>
            <div className="storm-cell delay storm-cell-2"></div>
            <div className="storm-label storm-label-1">P1</div>
            <div className="storm-label storm-label-2">P2</div>
          </div>
          <p className="panel-caption">Incident timeline · major outage (P1) · 12:35–13:05 GMT</p>
        </article>

        <article className="panel">
          <h3>Response time monitoring</h3>
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
          <p className="panel-caption">Average response 243ms · incident peak 500ms</p>
        </article>

        <article className="panel">
          <h3>Uptime reliability</h3>
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
          <p className="panel-caption">Overall uptime 99.3% · 30-day reliability</p>
        </article>
      </div>
    </section>

    {/*  ===== CTA =====  */}
    <section className="cta" id="cta">
      <h2>Start monitoring in minutes</h2>
      <p>Connect the AI APIs and apps you rely on, and get instant visibility into uptime, latency, and incidents.</p>
      <Link href={isAuth ? "/dashboard" : "/auth/register"} className="btn-primary">
        <span className="wheel-svg" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="21" stroke="currentColor" strokeWidth="3"/>
            <circle cx="30" cy="30" r="5" fill="currentColor"/>
            <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
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
        Go to the dashboard
      </Link>
    </section>
  </div>

  <footer className="site-footer">
    <div className="wrap">Beacon · Real-time status monitoring for the AI services you depend on.</div>
  </footer>


    </div>
  );
}
