'use client';

export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const PLATFORMS = [
  'Facebook', 'Instagram', 'LinkedIn', 'LinkedIn Pages', 'X (Twitter)',
  'TikTok', 'YouTube', 'Threads', 'Pinterest', 'Reddit',
  'Telegram', 'Discord', 'Bluesky', 'Mastodon', 'Medium',
  'WordPress', 'Hashnode', 'Dev.to', 'Google My Business', 'Dribbble',
  'Slack', 'WhatsApp', 'Kick', 'Twitch', 'Farcaster',
];

const FEATURES = [
  {
    label: 'All your channels',
    headline: 'Publish everywhere.\nFrom one place.',
    body: 'Connect 25+ social networks and schedule cross-posts with per-channel customisation. Instagram, LinkedIn, TikTok, X, YouTube — one workflow, every platform.',
    image: '/illus-basket.png',
    character: '/illus-celebrating.png',
    charSide: 'right' as const,
    charBottom: 'calc(100% - 108px)',
  },
  {
    label: 'AI content creation',
    headline: 'AI does the\nheavy lifting.',
    body: 'Generate hooks, captions, threads, and hashtags tuned per platform. Create images and short-form videos from prompts. Schedule full campaigns through conversational AI.',
    image: '/illus-thinking.png',
    character: '/illus-person.png',
    charSide: 'left' as const,
    charBottom: 'calc(100% - 140px)',
  },
  {
    label: 'Visual calendar',
    headline: 'Plan like a pro.\nPost like one.',
    body: 'A visual drag-and-drop calendar built for social teams. Schedule, recycle, and manage every post across every channel. Never miss a peak engagement window.',
    image: '/illus-planning.png',
    character: '/illus-reading.png',
    charSide: 'right' as const,
    charBottom: 'calc(100% - 108px)',
  },
  {
    label: 'Analytics',
    headline: 'Track what\nactually works.',
    body: 'Per-channel and per-post dashboards showing impressions, reach, engagement and growth. Compare across platforms. Double down on content that converts.',
    image: '/illus-dreaming.png',
    character: '/illus-writing.png',
    charSide: 'left' as const,
    charBottom: 'calc(100% - 128px)',
  },
];

const TEAM_CARDS = [
  {
    image: '/illus-writing.png',
    title: 'AI-powered creation',
    body: 'Captions, hooks, threads, hashtags, images — all generated and tuned per platform by AI.',
    tagline: 'Create with confidence.',
  },
  {
    image: '/illus-reading.png',
    title: 'Team collaboration',
    body: 'Shared calendar, drafts, and analytics. Invite your whole team, manage multiple brands.',
    tagline: 'Work better together.',
  },
  {
    image: '/illus-celebrating.png',
    title: 'Real-time analytics',
    body: "Track every post's performance across all channels from a single unified dashboard.",
    tagline: 'Know what works.',
  },
];

const BLOG_POSTS = [
  {
    image: '/blog-drafts.jpg',
    title: 'How to kick off with a shitty first draft',
    excerpt:
      '"202x is the perfect year to dive into content creation." This line pops up every December like clockwork, and posts pushing it always rack up...',
  },
  {
    image: '/blog-cooking.jpg',
    title: 'The Recipe for Viral Social Content',
    excerpt:
      "Consistent posting across 25+ platforms sounds overwhelming. Here's how modern marketing teams turned a 4-hour workflow into a 15-minute routine...",
  },
  {
    image: '/blog-creating.jpg',
    title: "Why You Still Haven't Started Creating?",
    excerpt:
      "I've been asked countless times: \"How do you express yourself with such confidence?\" The answer is simpler — and weirder — than you'd think...",
  },
];

const STATS = [
  { value: '25+', label: 'platforms' },
  { value: 'AI', label: 'content engine' },
  { value: '∞', label: 'team members' },
  { value: 'Live', label: 'analytics' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 56);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navMidLinkClass = scrolled
    ? 'text-white/70 hover:text-white'
    : 'text-[#6B6762] hover:text-[#1A1A1A]';

  return (
    <div
      className="min-h-screen text-[#1A1A1A]"
      style={{
        background: '#DEDAD4',
        fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
        overflowX: 'hidden',
      }}
    >
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .landing h1, .landing h2, .landing h3 {
          font-family: Georgia, "Times New Roman", serif;
        }
      `}</style>

      {/* ───── Sticky Nav ───── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? '#1A1A1A' : 'transparent',
          boxShadow: scrolled ? '0 1px 0 rgba(255,255,255,0.08)' : 'none',
        }}
      >
        <div
          className="max-w-[1200px] mx-auto px-[32px] flex items-center justify-between"
          style={{ height: 80 }}
        >
          <Link href="/" className="flex items-center gap-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hootnshoot-logo.png"
              alt="Hootnshoot"
              className="rounded-[8px] object-contain"
              style={{ width: 40, height: 40 }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: 20,
                color: scrolled ? '#fff' : '#1A1A1A',
                transition: 'color 0.3s',
              }}
            >
              Hootnshoot
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-[32px]" style={{ fontSize: 15, fontWeight: 500 }}>
            <a href="#features" className={`transition-colors ${navMidLinkClass}`}>
              Features
            </a>
            <a href="#platforms" className={`transition-colors ${navMidLinkClass}`}>
              Platforms
            </a>
            <a href="#teams" className={`transition-colors ${navMidLinkClass}`}>
              Teams
            </a>
            <a href="#blog" className={`transition-colors ${navMidLinkClass}`}>
              Blog
            </a>
          </div>

          <Link
            href="/sign-in"
            className="transition-colors hover:opacity-90"
            style={{
              fontSize: 15,
              fontWeight: 600,
              background: scrolled ? '#fff' : '#1A1A1A',
              color: scrolled ? '#1A1A1A' : '#fff',
              padding: '12px 22px',
              borderRadius: 11,
              transition: 'background 0.3s, color 0.3s',
            }}
          >
            Jump in →
          </Link>
        </div>
      </nav>

      {/* ───── Hero ───── */}
      <section className="landing flex items-center min-h-screen relative overflow-hidden pt-[80px]">
        {/* Ghost mascot floating top-right */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illus-ghost.png"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            top: 160,
            right: 100,
            width: 72,
            objectFit: 'contain',
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />

        <div
          className="max-w-[1200px] mx-auto px-[32px] w-full grid items-center gap-[48px]"
          style={{ gridTemplateColumns: '1fr 1fr', paddingTop: 80, paddingBottom: 80 }}
        >
          {/* Left */}
          <div>
            <div
              className="inline-flex items-center gap-[8px] mb-[28px]"
              style={{
                background: 'rgba(255,255,255,0.65)',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                color: '#6B6762',
                letterSpacing: '0.5px',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5DCB78', display: 'inline-block' }} />
              Built for modern marketing teams
            </div>

            <h1
              className="text-[#1A1A1A] mb-[24px]"
              style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-1px' }}
            >
              Schedule smarter.
              <br />
              Post bolder.
            </h1>

            <p style={{ fontSize: 18, lineHeight: 1.65, color: '#6B6762', maxWidth: 460, marginBottom: 40 }}>
              The all-in-one social media platform for modern marketing teams. Create AI-powered content,
              schedule across 25+ platforms, and track performance — all from one connected place.
            </p>

            <div className="flex flex-wrap items-center gap-[14px]">
              <Link
                href="/sign-in"
                className="transition-colors hover:opacity-85"
                style={{
                  background: '#1A1A1A',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  padding: '14px 28px',
                  borderRadius: 12,
                }}
              >
                Let's get posting →
              </Link>
              <a
                href="#features"
                className="flex items-center gap-[6px] text-[#6B6762] text-[15px] font-medium transition-colors hover:text-[#1A1A1A]"
              >
                See features
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                  <path d="M3 7.5h9M9 4l3.5 3.5L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>

            <div className="flex flex-wrap gap-[36px] mt-[52px]">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#1A1A1A', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, color: '#888480', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illus-basket.png"
              alt=""
              aria-hidden
              style={{ width: '100%', maxWidth: 560, objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
          </div>
        </div>
      </section>

      {/* ───── Platforms marquee ───── */}
      <section
        id="platforms"
        style={{
          background: '#F5F2ED',
          borderTop: '1px solid #C8C4BC',
          borderBottom: '1px solid #C8C4BC',
          padding: '28px 0',
        }}
      >
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: '#888480', textTransform: 'uppercase', marginBottom: 16 }}>
          Schedule to 25+ platforms
        </p>
        <div style={{ overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', animation: 'marquee 30s linear infinite' }}>
            {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
              <span key={i} style={{ fontSize: 13, fontWeight: 500, color: '#888480' }}>{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Feature Sections (YouMind box style) ───── */}
      <div id="features" className="landing" style={{ background: '#DEDAD4', padding: '80px 0 40px' }}>
        <div className="max-w-[1100px] mx-auto px-[32px]">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 44, fontWeight: 700, color: '#1A1A1A', marginBottom: 16, lineHeight: 1.15 }}>
              Everything you need to post smarter.
            </h2>
            <p style={{ fontSize: 17, color: '#6B6762', maxWidth: 520, margin: '0 auto' }}>
              One platform to create, schedule, and analyse across all your channels.
            </p>
          </div>

          {FEATURES.map((f, i) => (
            <div key={i} style={{ position: 'relative', paddingTop: 100, marginBottom: 44 }}>
              {/* Character sitting on top of the box */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.character}
                alt=""
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: f.charBottom,
                  ...(f.charSide === 'right' ? { right: 52 } : { left: 52 }),
                  width: 140,
                  objectFit: 'contain',
                  objectPosition: 'bottom',
                  mixBlendMode: 'multiply',
                  zIndex: 2,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />

              {/* Main box */}
              <div
                style={{
                  background: i % 2 === 0 ? '#F5F2ED' : '#EEE9E2',
                  borderRadius: 24,
                  display: 'flex',
                  flexDirection: i % 2 === 0 ? 'row' : 'row-reverse',
                  overflow: 'hidden',
                  minHeight: 320,
                  boxShadow: '0 2px 20px rgba(0,0,0,0.04)',
                }}
              >
                {/* Illustration panel */}
                <div
                  style={{
                    flex: '0 0 42%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 28px',
                    background: i % 2 === 0 ? '#EAE5DE' : '#E4DFD7',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.image}
                    alt=""
                    aria-hidden
                    style={{ width: '100%', maxWidth: 280, objectFit: 'contain', mixBlendMode: 'multiply' }}
                  />
                </div>

                {/* Text panel */}
                <div
                  style={{
                    flex: 1,
                    padding: '52px 56px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#888480', marginBottom: 16 }}>
                    {f.label}
                  </p>
                  <h2
                    style={{
                      fontSize: 38,
                      fontWeight: 700,
                      lineHeight: 1.15,
                      color: '#1A1A1A',
                      marginBottom: 20,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {f.headline}
                  </h2>
                  <p style={{ fontSize: 16, lineHeight: 1.75, color: '#6B6762', maxWidth: 380 }}>{f.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───── Teams Section (vertical stack) ───── */}
      <section
        id="teams"
        className="landing"
        style={{ background: '#F5F2ED', padding: '96px 0', borderTop: '1px solid #C8C4BC' }}
      >
        <div className="max-w-[900px] mx-auto px-[32px]">
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <h2 style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.15, color: '#1A1A1A', marginBottom: 16 }}>
              Built for teams.
              <br />
              Loved by creators.
            </h2>
            <p style={{ fontSize: 17, color: '#6B6762', lineHeight: 1.65, maxWidth: 480, margin: '0 auto' }}>
              Invite your whole team, manage multiple brands, and collaborate on every post — all from one shared workspace.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
            {TEAM_CARDS.map((card, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
                {/* Illustration */}
                <div style={{ flexShrink: 0, width: 200 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image}
                    alt=""
                    style={{ width: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                  />
                </div>
                {/* Text */}
                <div>
                  <h3 style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>{card.title}</h3>
                  <p style={{ fontSize: 16, color: '#6B6762', lineHeight: 1.75, maxWidth: 480, marginBottom: 14 }}>{card.body}</p>
                  <p style={{ fontSize: 15, color: '#9B9490', fontStyle: 'italic' }}>{card.tagline}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Blog Section ───── */}
      <section
        id="blog"
        className="landing"
        style={{ background: '#DEDAD4', padding: '96px 0' }}
      >
        <div className="max-w-[1100px] mx-auto px-[32px]">
          <h2
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: '#1A1A1A',
              textAlign: 'center',
              marginBottom: 52,
            }}
          >
            From the Hootnshoot blog
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {BLOG_POSTS.map((post, i) => (
              <article
                key={i}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '1px solid #E0DDD8',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                }}
                className="hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image}
                  alt={post.title}
                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '24px 22px 28px' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 10 }}>
                    {post.title}
                  </h3>
                  <p style={{ fontSize: 14, color: '#888480', lineHeight: 1.65 }}>{post.excerpt}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA — "Learn smarter. Create bolder." ───── */}
      <section
        className="landing"
        style={{ background: '#F5F2ED', padding: '120px 0', borderTop: '1px solid #C8C4BC' }}
      >
        <div className="max-w-[800px] mx-auto px-[32px]" style={{ textAlign: 'center' }}>
          <h2
            style={{
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#1A1A1A',
              marginBottom: 48,
            }}
          >
            <span
              style={{
                background: '#C8DEFF',
                padding: '0 8px',
                borderRadius: 6,
                display: 'inline',
              }}
            >
              Learn smarter.
            </span>
            {' '}
            <span
              style={{
                background: '#C8DEFF',
                padding: '0 8px',
                borderRadius: 6,
                display: 'inline',
              }}
            >
              Create bolder.
            </span>
          </h2>
          <Link
            href="/sign-in"
            className="inline-block transition-colors hover:opacity-85"
            style={{
              background: '#1A1A1A',
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              padding: '18px 56px',
              borderRadius: 999,
            }}
          >
            Time to post 🚀
          </Link>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer
        style={{
          background: '#DEDAD4',
          borderTop: '1px solid #C8C4BC',
          padding: '64px 0 40px',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-[32px]">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '240px 1fr 1fr 1fr',
              gap: 48,
              marginBottom: 48,
            }}
          >
            {/* Brand column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hootnshoot-logo.png"
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }}
                />
                <span style={{ fontWeight: 700, fontSize: 16, color: '#1A1A1A' }}>Hootnshoot</span>
              </div>
              <p style={{ fontSize: 13, color: '#888480', lineHeight: 1.65, marginBottom: 20 }}>
                Social scheduling for modern marketing teams.
              </p>
              <p style={{ fontSize: 12, color: '#9B9490' }}>© 2026 Hootnshoot.</p>
            </div>

            {/* Blog column */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 18, letterSpacing: '0.4px' }}>
                Blog
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {BLOG_POSTS.map((p, i) => (
                  <li key={i}>
                    <a
                      href="#blog"
                      style={{ fontSize: 13, color: '#6B6762', textDecoration: 'none' }}
                      className="hover:text-[#1A1A1A] transition-colors"
                    >
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Product column */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 18, letterSpacing: '0.4px' }}>
                Product
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                <li><a href="#features" style={{ fontSize: 13, color: '#6B6762', textDecoration: 'none' }} className="hover:text-[#1A1A1A] transition-colors">Features</a></li>
                <li><a href="#platforms" style={{ fontSize: 13, color: '#6B6762', textDecoration: 'none' }} className="hover:text-[#1A1A1A] transition-colors">Platforms</a></li>
                <li><Link href="/sign-in" style={{ fontSize: 13, color: '#6B6762', textDecoration: 'none' }} className="hover:text-[#1A1A1A] transition-colors">Get access</Link></li>
              </ul>
            </div>

            {/* Company column */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 18, letterSpacing: '0.4px' }}>
                Company
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                <li><Link href="/terms" style={{ fontSize: 13, color: '#6B6762', textDecoration: 'none' }} className="hover:text-[#1A1A1A] transition-colors">Terms</Link></li>
                <li><Link href="/privacy" style={{ fontSize: 13, color: '#6B6762', textDecoration: 'none' }} className="hover:text-[#1A1A1A] transition-colors">Privacy</Link></li>
                <li><a href="mailto:support@hootnshoot.app" style={{ fontSize: 13, color: '#6B6762', textDecoration: 'none' }} className="hover:text-[#1A1A1A] transition-colors">Contact us</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              borderTop: '1px solid #C8C4BC',
              paddingTop: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <p style={{ fontSize: 12, color: '#9B9490' }}>
              Social scheduling for modern marketing teams.
            </p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {/* Discord */}
              <a href="#" aria-label="Discord" style={{ color: '#BBBAB6' }} className="hover:text-[#1A1A1A] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.12 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              </a>
              {/* X/Twitter */}
              <a href="#" aria-label="X (Twitter)" style={{ color: '#BBBAB6' }} className="hover:text-[#1A1A1A] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
