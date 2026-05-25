'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

const APPLY_START_HREF = '/sign-up?next=/apply';
const VIEW_APPLICATION_HREF = '/sign-in?next=/dashboard';

const OFFSCREEN_MOUSE = { x: -999, y: -999 };
const PARTICLE_COUNT = 70;
const LINE_DIST = 130;

function getInitialMode() {
  if (typeof window === 'undefined') return 'light';

  const saved = window.localStorage.getItem('capstack_theme');
  if (saved === 'dark' || saved === 'light') return saved;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function HeroSection() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const mouseRef = useRef(OFFSCREEN_MOUSE);
  const rafRef = useRef(0);

  const [mode, setMode] = useState('light');

  const particlesRef = useRef([]);

  // Keep drawing logic in a single effect so it can't get corrupted by partial edits.
  useEffect(() => {
    const preferred = getInitialMode();
    setMode(preferred);
    document.documentElement.setAttribute('data-theme', preferred);
    window.localStorage.setItem('capstack_theme', preferred);
  }, []);

  useEffect(() => {
    if (!wrapperRef.current || !canvasRef.current) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const createParticle = (width, height) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() * 0.6) - 0.3,
      vy: (Math.random() * 0.6) - 0.3,
      r: 1 + (Math.random() * 1.5),
    });

    const resize = () => {
      const { width, height } = wrapper.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));

      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(canvas.width, canvas.height));
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Mouse glow
      const m = mouseRef.current;
      const glowRadius = 120;
      const distToMouse = (x, y) => Math.hypot(x - m.x, y - m.y);

      const particles = particlesRef.current;

      // Lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
          if (d < LINE_DIST) {
            const alpha = (1 - d / LINE_DIST) * 0.1;
            ctx.strokeStyle = `rgba(120, 120, 120, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Nodes + mouse interaction
      for (const p of particles) {
        const d = distToMouse(p.x, p.y);
        const t = Math.max(0, 1 - d / glowRadius);
        const nodeAlpha = 0.35 + t * 0.4;

        ctx.fillStyle = `rgba(0, 0, 0, ${nodeAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < p.r || p.x > w - p.r) p.vx *= -1;
        if (p.y < p.r || p.y > h - p.r) p.vy *= -1;
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    const handleMouseMove = (event) => {
      const bounds = wrapper.getBoundingClientRect();
      mouseRef.current = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = OFFSCREEN_MOUSE;
    };

    resize();

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseleave', handleMouseLeave);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(wrapper);
    else window.addEventListener('resize', resize);

    rafRef.current = window.requestAnimationFrame(draw);

    return () => {
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);

      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);

      window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const gradientStyle = useMemo(() => {
    // Theme is handled by documentElement data-theme + global CSS.
    // Keep this inline style minimal and safe.
    return {
      background:
        'linear-gradient(180deg, rgba(249, 248, 246, 0.98) 0%, rgba(249, 248, 246, 0.94) 100%), rgb(249, 248, 246)',
    };
  }, []);

  return (
    <section
      ref={wrapperRef}
      className="capstackHero"
      style={gradientStyle}
    >
      <canvas
        ref={canvasRef}
        className="capstackHero__canvas"
        aria-hidden="true"
      />

      <div className="capstackHero__content">
        <nav className="capstackHero__nav" aria-label="Primary">
          <Link href="/" className="capstackHero__brand">
            Capstack
          </Link>

          <div className="capstackHero__navActions">
            <button
              type="button"
              className="capstackHero__toggle"
              onClick={() => {
                const nextMode = mode === 'dark' ? 'light' : 'dark';
                setMode(nextMode);
                document.documentElement.setAttribute('data-theme', nextMode);
                window.localStorage.setItem('capstack_theme', nextMode);
              }}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={mode === 'dark'}
            >
              <span aria-hidden="true">{mode === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            <Link href="/sign-in" className="capstackHero__navLink">
              Sign in
            </Link>

            <Link href={APPLY_START_HREF} className="capstackHero__navCta">
              Apply now
            </Link>
          </div>
        </nav>

        <div className="capstackHero__main">
          <div className="capstackHero__eyebrow">Fast · Transparent · Fair</div>

          <h1 className="capstackHero__headline">Finance that moves at the speed of your next decision.</h1>

          <p className="capstackHero__copy">
            Apply for a personal or business loan in minutes, track every step securely, and access clear terms with enterprise-grade reliability.
          </p>

          <div className="capstackHero__actions">
            <Link href={APPLY_START_HREF} className="capstackHero__button capstackHero__button--primary">
              Apply for a loan
            </Link>

            <Link href={VIEW_APPLICATION_HREF} className="capstackHero__button capstackHero__button--secondary">
              View my application
            </Link>
          </div>

          <div className="capstackHero__meta">
            <div>
              <strong>24h</strong>
              <span>Typical funding window</span>
            </div>
            <div>
              <strong>Bank-grade</strong>
              <span>Secure borrower access</span>
            </div>
            <div>
              <strong>End-to-end</strong>
              <span>Application tracking and servicing</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .capstackHero {
          position: relative;
          overflow: hidden;
          min-height: 44rem;
          isolation: isolate;
          transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease;
          font-family: Neuemontreal, Arial, sans-serif;
        }

        .capstackHero__canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
        }

        .capstackHero__content {
          position: relative;
          z-index: 2;
          width: min(100%, 80rem);
          margin: 0 auto;
          padding: 1.5rem 1.5rem 5rem;
        }

        .capstackHero__nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.5rem 0;
        }

        .capstackHero__brand {
          font-family: "Dentonvariabletest Vf", "Times New Roman", sans-serif;
          font-size: 1.35rem;
          font-weight: 700;
          text-decoration: none;
          letter-spacing: -0.03em;
          color: inherit;
        }

        .capstackHero__navActions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .capstackHero__toggle,
        .capstackHero__navLink,
        .capstackHero__navCta,
        .capstackHero__button {
          border-radius: 999px;
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 600;
          line-height: 1;
          padding: 0.95rem 1.35rem;
          transition: transform 160ms ease, background-color 160ms ease, color 160ms ease, border-color 160ms ease;
        }

        .capstackHero__toggle {
          cursor: pointer;
          border: 1px solid;
          background: transparent;
        }

        .capstackHero__navLink {
          background: transparent;
        }

        .capstackHero__navCta {
          border: 1px solid transparent;
        }

        .capstackHero__main {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 5.5rem 0 2rem;
        }

        .capstackHero__eyebrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid;
          padding: 0.6rem 1rem;
          margin-bottom: 1.5rem;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .capstackHero__headline {
          max-width: 13ch;
          margin: 0;
          font-family: "Dentonvariabletest Vf", "Times New Roman", sans-serif;
          font-size: clamp(2.75rem, 6vw, 5.35rem);
          font-weight: 700;
          line-height: 0.95;
          letter-spacing: -0.05em;
          text-wrap: balance;
        }

        .capstackHero__copy {
          max-width: 43rem;
          margin: 1.5rem 0 0;
          font-size: clamp(1rem, 1.6vw, 1.2rem);
          line-height: 1.7;
          text-wrap: balance;
        }

        .capstackHero__actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem;
          margin-top: 2rem;
        }

        .capstackHero__button {
          min-width: 15rem;
          border: 1px solid transparent;
        }

        .capstackHero__meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          width: min(100%, 52rem);
          margin-top: 3rem;
        }

        .capstackHero__meta > div {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 1rem 1.15rem;
          border-radius: 1.25rem;
          border: 1px solid;
          backdrop-filter: blur(12px);
        }

        .capstackHero__meta strong {
          font-family: "Dentonvariabletest Vf", "Times New Roman", sans-serif;
          font-size: 1.15rem;
        }

        .capstackHero__meta span {
          font-size: 0.92rem;
          line-height: 1.5;
        }

        .capstackHero.light {
          background: linear-gradient(180deg, rgba(249, 248, 246, 0.98) 0%, rgba(249, 248, 246, 0.94) 100%), rgb(249, 248, 246);
          color: rgb(14, 13, 12);
        }

        .capstackHero.dark {
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.98) 0%, rgba(14, 13, 12, 0.98) 100%), rgb(0, 0, 0);
          color: rgb(249, 248, 246);
        }

        @media (max-width: 900px) {
          .capstackHero {
            min-height: 40rem;
          }
          .capstackHero__content {
            padding-bottom: 4rem;
          }
          .capstackHero__nav {
            flex-direction: column;
            align-items: stretch;
          }
          .capstackHero__navActions {
            justify-content: stretch;
          }
          .capstackHero__toggle,
          .capstackHero__navLink,
          .capstackHero__navCta {
            text-align: center;
          }
          .capstackHero__meta {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .capstackHero__content {
            padding-left: 1rem;
            padding-right: 1rem;
          }
          .capstackHero__main {
            padding-top: 4.25rem;
          }
          .capstackHero__actions {
            width: 100%;
            flex-direction: column;
          }
          .capstackHero__button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}

