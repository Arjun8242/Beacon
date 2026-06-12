'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('brinewinds27');
  const [remember, setRemember] = useState(true);
  const [passkey, setPasskey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('auth-body');
    
    // Redirect guard if already authenticated
    if (api.isAuthenticated()) {
      router.push('/');
    }

    return () => {
      document.body.classList.remove('auth-body');
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await api.login(email, password);
      // Success - Redirect to landing page
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Invalid credentials or connection error');
    } finally {
      setIsLoading(false);
    }
  };

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
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }}>
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
          <Link href="/"><span aria-hidden="true">~</span><span className="label">Explore public status</span></Link>
          <a href="#"><span className="label">Help</span></a>
          <Link href="/auth/register" className="signup">Sign Up</Link>
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
        <section className="auth-card">
          <h1>Signal the Beacon</h1>
          <p className="subtitle">Secure Harbor Access</p>

          {error && (
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
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="email">Fleet Email / Harbor Ident</label>
            <div className="input-wrap">
              <input
                type="email"
                id="email"
                placeholder="fleetadmin@example.voyage"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="5" r="2.5"/>
                <path d="M12 7.5v5M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>
              </svg>
            </div>

            <label className="field-label" htmlFor="key">Voyage Key / Password</label>
            <div className="input-wrap">
              <input
                type="password"
                id="key"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3 2"/>
              </svg>
            </div>

            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={isLoading}
              />
              Remember this Harbor
            </label>

            <label className="field-label" htmlFor="passkey">Secure Voyage Passkey</label>
            <div className="input-wrap">
              <input
                type="text"
                id="passkey"
                placeholder="Optional"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button className="enter-btn" type="submit" disabled={isLoading}>
              <span className="wheel-svg" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="30" cy="30" r="21" stroke="currentColor" stroke-width="3"/>
                  <circle cx="30" cy="30" r="5" fill="currentColor"/>
                  <g stroke="currentColor" stroke-width="3" strokeLinecap="round">
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
              <span>{isLoading ? 'Entering...' : 'Enter Harbor'}</span>
              <span className="mini-lighthouse" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 22h6l-1-4H10z" opacity=".5"/>
                  <path d="M8 18h8l-1.4-12h-5.2z"/>
                  <path d="M9.6 6h4.8L12 2z"/>
                </svg>
              </span>
            </button>
          </form>

          <div className="links-below">
            <p>Don't have a harbor? <Link href="/auth/register">Create a New Fleet</Link></p>
            <p>Forgot Voyage Key? <a href="#">Signal Support</a></p>
          </div>
        </section>
      </main>

      <footer className="harbor-footer" aria-hidden="true">
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
            <text x="60" y="14" text-anchor="middle" fontFamily="Cinzel, serif" fontSize="11" fill="var(--parchment)">N</text>
            <text x="60" y="112" text-anchor="middle" fontFamily="Cinzel, serif" fontSize="11" fill="var(--parchment)">S</text>
            <text x="8" y="64" text-anchor="middle" fontFamily="Cinzel, serif" fontSize="11" fill="var(--parchment)">W</text>
            <text x="112" y="64" text-anchor="middle" fontFamily="Cinzel, serif" fontSize="11" fill="var(--parchment)">E</text>
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
