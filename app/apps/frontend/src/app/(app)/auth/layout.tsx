export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#DEDAD4',
        display: 'flex',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
      }}
    >
      <ReturnUrlComponent />

      {/* ── LEFT HALF — plant decoration + white card ── */}
      <div
        style={{
          width: '50%',
          minWidth: 560,
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          padding: '40px 56px',
        }}
      >
        {/* Decorative plant — left edge, fully visible */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illus-left-plant.png"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            bottom: 20,
            width: 180,
            objectFit: 'contain',
            objectPosition: 'bottom',
            mixBlendMode: 'multiply',
            zIndex: 0,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />

        {/* White floating card — stretches full height minus padding */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 560,
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #E0DDD8',
            padding: '52px 56px 48px',
            boxShadow: '0 4px 40px rgba(0,0,0,0.07)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: 44 }}>
            <LogoTextComponent />
          </div>

          {/* Form content — fills available space */}
          <div style={{ color: '#1A1A1A', flex: 1 }}>
            {children}
          </div>

          {/* Terms text */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9B9490', marginTop: 32, lineHeight: 1.6 }}>
            By continuing, you agree to the{' '}
            <a href="https://hootnshoot.app/terms" style={{ color: '#6B6762', textDecoration: 'underline' }}>
              Terms
            </a>
            ,{' '}
            <a href="https://hootnshoot.app/privacy" style={{ color: '#6B6762', textDecoration: 'underline' }}>
              Privacy
            </a>
          </p>

          {/* GitHub link at bottom */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <a
              href="https://github.com/solankiharsh/hootnshoot"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#BBBAB6' }}
              className="hover:text-[#1A1A1A] transition-colors"
              aria-label="GitHub"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>

          {/* Decorative star — bottom right of card */}
          <div style={{ position: 'absolute', bottom: 20, right: 24, opacity: 0.2 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M9 0V18M0 9H18M2.6 2.6L15.4 15.4M15.4 2.6L2.6 15.4" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── RIGHT HALF — tagline + illustration ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Moon crescent */}
        <svg style={{ position: 'absolute', top: 56, left: 48 }} width="52" height="60" viewBox="0 0 52 60" fill="none" aria-hidden>
          <path d="M38 5C22 5 10 17.5 10 33C10 48.5 22 55 34 55C20 51 14 41 18 29C22 17 34 11 46 13C44.5 8 41.5 5 38 5Z" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>

        {/* Small star — top right */}
        <svg style={{ position: 'absolute', top: 68, right: 96 }} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M9 0V18M0 9H18M2.6 2.6L15.4 15.4M15.4 2.6L2.6 15.4" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
        </svg>

        {/* Tagline — mid height, lighter weight serif */}
        <div style={{ position: 'absolute', top: '11%', left: '14%', maxWidth: 400 }}>
          <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 48, fontWeight: 400, lineHeight: 1.2, color: '#1A1A1A' }}>
            Schedule smarter.
            <br />
            Post bolder.
          </h2>
        </div>

        {/* Large star — mid left */}
        <svg style={{ position: 'absolute', bottom: '34%', left: '6%' }} width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
          <path d="M13 0V26M0 13H26M3.8 3.8L22.2 22.2M22.2 3.8L3.8 22.2" stroke="#1A1A1A" strokeWidth="2.2" strokeLinecap="round" />
        </svg>

        {/* Main illustration */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illus-thinking.png"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '100%',
            maxWidth: 820,
            objectFit: 'contain',
            objectPosition: 'right bottom',
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </div>
    </div>
  );
}
