'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const APPLY_START_HREF = '/sign-up?next=/apply';
const VIEW_APPLICATION_HREF = '/sign-in?next=/dashboard';
const PARTICLE_COUNT = 70;
const LINE_DISTANCE = 130;
const MOUSE_DISTANCE = 160;
const OFFSCREEN_MOUSE = { x: -999, y: -999 };

function createParticle(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() * 0.6) - 0.3,
    vy: (Math.random() * 0.6) - 0.3,
    radius: 1 + (Math.random() * 1.5),
  };
}

function getInitialMode() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const saved = window.localStorage.getItem('capstack_theme');
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getCanvasPalette(mode) {
  if (mode === 'dark') {
    return {
      nodeColor: 'rgba(255, 255, 255, 0.30)',
      lineRgb: '255, 255, 255',
      lineMaxAlpha: 0.12,
      mouseRgb: '92, 219, 122',
      mouseLineMaxAlpha: 0.18,
      glowInner: 'rgba(92, 219, 122, 0.07)',
    };
  }

  return {
    nodeColor: 'rgba(0, 0, 0, 0.22)',
    lineRgb: '0, 0, 0',
    lineMaxAlpha: 0.10,
    mouseRgb: '0, 0, 0',
    mouseLineMaxAlpha: 0.22,
    glowInner: 'rgba(0, 0, 0, 0.05)',
  };
}

export default function HeroSection() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const mouseRef = useRef(OFFSCREEN_MOUSE);
  const [mode, setMode] = useState('light');

  useEffect(() => {
    const preferred = getInitialMode();
    setMode(preferred);
    document.documentElement.setAttribute('data-theme', preferred);
    window.localStorage.setItem('capstack_theme', preferred);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!wrapper || !canvas || !context) {
      return undefined;
    }

    const particles = [];
    const palette = getCanvasPalette(mode);
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    let animationFrameId = 0;
    let width = 0;
    let height = 0;

    const resizeCanvas = () => {
      width = wrapper.clientWidth;
      height = wrapper.clientHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        for (let index = 0; index < PARTICLE_COUNT; index += 1) {
          particles.push(createParticle(width, height));
        }
        return;
      }

      particles.forEach((particle) => {
        particle.x = Math.min(Math.max(particle.x, particle.radius), width - particle.radius);
        particle.y = Math.min(Math.max(particle.y, particle.radius), height - particle.radius);
      });
    };

    const drawMouseGlow = () => {
      const { x, y } = mouseRef.current;
      if (x < 0 || y < 0) {
        return;
      }

      const glow = context.createRadialGradient(x, y, 0, x, y, 360);
      glow.addColorStop(0, palette.glowInner);
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');

      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, 360, 0, Math.PI * 2);
      context.fill();
    };

    const drawLines = () => {
      for (let first = 0; first < particles.length; first += 1) {
        for (let second = first + 1; second < particles.length; second += 1) {
          const a = particles[first];
          const b = particles[second];
          const deltaX = a.x - b.x;
          const deltaY = a.y - b.y;
          const distance = Math.hypot(deltaX, deltaY);

          if (distance > LINE_DISTANCE) {
            continue;
          }

          const alpha = (1 - (distance / LINE_DISTANCE)) * palette.lineMaxAlpha;
          context.strokeStyle = `rgba(${palette.lineRgb}, ${alpha})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      const { x, y } = mouseRef.current;
      if (x < 0 || y < 0) {
        return;
      }

      particles.forEach((particle) => {
        const distance = Math.hypot(particle.x - x, particle.y - y);
        if (distance > MOUSE_DISTANCE) {
          return;
        }

        const alpha = (1 - (distance / MOUSE_DISTANCE)) * palette.mouseLineMaxAlpha;
        context.strokeStyle = `rgba(${palette.mouseRgb}, ${alpha})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(x, y);
        context.stroke();
      });
    };

    const drawNodes = () => {
      particles.forEach((particle) => {
        context.fillStyle = palette.nodeColor;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
    };

    const moveParticles = () => {
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x <= particle.radius || particle.x >= width - particle.radius) {
          particle.vx *= -1;
          particle.x = Math.min(Math.max(particle.x, particle.radius), width - particle.radius);
        }

        if (particle.y <= particle.radius || particle.y >= height - particle.radius) {
          particle.vy *= -1;
          particle.y = Math.min(Math.max(particle.y, particle.radius), height - particle.radius);
        }
      });
    };

    const animate = () => {
      context.clearRect(0, 0, width, height);
      drawMouseGlow();
      drawLines();
      drawNodes();
      moveParticles();
      animationFrameId = window.requestAnimationFrame(animate);
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

    resizeCanvas();
    animate();

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseleave', handleMouseLeave);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(wrapper);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);

      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', resizeCanvas);
      }
    };
  }, [mode]);

  return (
    <section ref={wrapperRef} className={`capstackHero ${mode}`}>
      <canvas ref={canvasRef} className="capstackHero__canvas" aria-hidden="true" />

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

          <h1 className="capstackHero__headline">
            Finance that moves at the speed of your next decision.
          </h1>

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

        .capstackHero.light {
          background:
            linear-gradient(180deg, rgba(249, 248, 246, 0.98) 0%, rgba(249, 248, 246, 0.94) 100%),
            rgb(249, 248, 246);
          color: rgb(14, 13, 12);
        }

        .capstackHero.dark {
          background:
            linear-gradient(180deg, rgba(0, 0, 0, 0.98) 0%, rgba(14, 13, 12, 0.98) 100%),
            rgb(0, 0, 0);
          color: rgb(249, 248, 246);
        }

        .capstackHero__canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
        }

        .capstackHero__content {
          position: relative;
          z-index: 1;
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
          font-size: clamp(3.2rem, 7vw, 6.25rem);
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

        .capstackHero.light .capstackHero__toggle,
        .capstackHero.light .capstackHero__navLink {
          color: rgb(14, 13, 12);
          border-color: rgba(0, 0, 0, 0.14);
        }

        .capstackHero.light .capstackHero__toggle:hover,
        .capstackHero.light .capstackHero__navLink:hover,
        .capstackHero.light .capstackHero__navCta:hover,
        .capstackHero.light .capstackHero__button:hover {
          transform: translateY(-1px);
        }

        .capstackHero.light .capstackHero__navCta {
          background: rgb(14, 13, 12);
          color: rgb(249, 248, 246);
        }

        .capstackHero.light .capstackHero__eyebrow,
        .capstackHero.light .capstackHero__meta > div {
          color: rgb(32, 32, 31);
          border-color: rgba(0, 0, 0, 0.12);
          background: rgba(255, 255, 255, 0.42);
        }

        .capstackHero.light .capstackHero__copy,
        .capstackHero.light .capstackHero__meta span {
          color: rgba(14, 13, 12, 0.72);
        }

        .capstackHero.light .capstackHero__button--primary {
          background: rgb(14, 13, 12);
          color: rgb(249, 248, 246);
          border-color: rgb(14, 13, 12);
        }

        .capstackHero.light .capstackHero__button--secondary {
          background: transparent;
          color: rgb(14, 13, 12);
          border-color: rgba(14, 13, 12, 0.42);
        }

        .capstackHero.dark .capstackHero__toggle,
        .capstackHero.dark .capstackHero__navLink {
          color: rgb(249, 248, 246);
          border-color: rgba(249, 248, 246, 0.24);
        }

        .capstackHero.dark .capstackHero__toggle:hover,
        .capstackHero.dark .capstackHero__navLink:hover,
        .capstackHero.dark .capstackHero__navCta:hover,
        .capstackHero.dark .capstackHero__button:hover {
          transform: translateY(-1px);
        }

        .capstackHero.dark .capstackHero__navCta {
          background: rgb(249, 248, 246);
          color: rgb(0, 0, 0);
        }

        .capstackHero.dark .capstackHero__eyebrow,
        .capstackHero.dark .capstackHero__meta > div {
          color: rgba(249, 248, 246, 0.9);
          border-color: rgba(249, 248, 246, 0.14);
          background: rgba(14, 13, 12, 0.52);
        }

        .capstackHero.dark .capstackHero__copy,
        .capstackHero.dark .capstackHero__meta span {
          color: rgba(249, 248, 246, 0.72);
        }

        .capstackHero.dark .capstackHero__button--primary {
          background: rgb(249, 248, 246);
          color: rgb(0, 0, 0);
          border-color: rgb(249, 248, 246);
        }

        .capstackHero.dark .capstackHero__button--secondary {
          background: transparent;
          color: rgb(249, 248, 246);
          border-color: rgba(249, 248, 246, 0.42);
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