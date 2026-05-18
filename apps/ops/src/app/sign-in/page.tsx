'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOpsAuthModeLabel, getPublicOpsAuthConfig, OPS_SSO_PROVIDER_LABELS, type OpsSsoProvider } from '@/lib/auth-config';
import { setSession } from '@/lib/session';
import { MeshPatternOverlay } from '@/app/_components/MeshPatternOverlay';

const AUTH_CONFIG = getPublicOpsAuthConfig();
const AUTH_MODE_LABEL = getOpsAuthModeLabel(AUTH_CONFIG.mode);
const SSO_PROVIDER_ORDER: OpsSsoProvider[] = ['google', 'microsoft'];
const PARTICLE_COUNT = 70;
const LINE_DISTANCE = 130;
const MOUSE_DISTANCE = 160;
const OFFSCREEN_MOUSE = { x: -999, y: -999 };

function createParticle(width: number, height: number) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() * 0.6) - 0.3,
    vy: (Math.random() * 0.6) - 0.3,
    radius: 1 + (Math.random() * 1.5),
  };
}

function getThemeMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function getCanvasPalette(mode: 'light' | 'dark') {
  if (mode === 'dark') {
    return {
      nodeColor: 'rgba(255, 255, 255, 0.30)',
      lineRgb: '255, 255, 255',
      lineMaxAlpha: 0.15,
      mouseRgb: '92, 219, 122',
      mouseLineMaxAlpha: 0.2,
      glowInner: 'rgba(92, 219, 122, 0.07)',
    };
  }

  return {
    nodeColor: 'rgba(0, 0, 0, 0.26)',
    lineRgb: '0, 0, 0',
    lineMaxAlpha: 0.13,
    mouseRgb: '0, 0, 0',
    mouseLineMaxAlpha: 0.24,
    glowInner: 'rgba(0, 0, 0, 0.05)',
  };
}

export default function StaffSignIn() {
  const router   = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef(OFFSCREEN_MOUSE);
  const [email,  setEmail]   = useState('');
  const [error,  setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const provider = params.get('provider');
    if (!reason) {
      return;
    }

    setError(getReasonMessage(reason, provider));
  }, []);

  useEffect(() => {
    const syncThemeMode = () => setThemeMode(getThemeMode());
    syncThemeMode();

    const observer = new MutationObserver(syncThemeMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
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

    const particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];
    const palette = getCanvasPalette(themeMode);
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    let width = 0;
    let height = 0;
    let animationFrameId = 0;

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
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
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

    const handleMouseMove = (event: MouseEvent) => {
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

    let resizeObserver: ResizeObserver | undefined;
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
  }, [themeMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res  = await fetch('/api/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Sign-in failed.');
        setLoading(false);
        return;
      }

      setSession(json);
      router.replace('/applications');
    } catch {
      setError('Could not reach the server. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background: themeMode === 'dark'
          ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.98) 0%, rgba(14, 13, 12, 0.98) 100%), rgb(0, 0, 0)'
          : 'linear-gradient(180deg, rgba(249, 248, 246, 0.98) 0%, rgba(249, 248, 246, 0.94) 100%), rgb(249, 248, 246)',
      }}
    >
      <MeshPatternOverlay mode={themeMode} />

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      <div
        className="w-full max-w-md rounded-2xl p-9 relative z-10"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.24em] px-3 py-1 rounded-full"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-secondary)', border: '1px solid var(--color-border)' }}
            >
              Internal Workspace
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.18em] px-3 py-1 rounded-full"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
            >
              {AUTH_MODE_LABEL}
            </span>
          </div>

          <div className="font-extrabold text-[1.85rem] tracking-tight mb-2">Capstack Ops Console</div>
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Internal underwriting, servicing, collections, and portfolio operations.
          </div>
        </div>

        <div
          className="rounded-xl px-4 py-4 mb-5"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-primary)' }}>
            Authentication
          </div>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            {AUTH_CONFIG.mode === 'demo'
              ? 'This preview uses passwordless work-email sign-in for provisioned internal users.'
              : AUTH_CONFIG.mode === 'passwordless'
                ? 'This environment uses passwordless work-email sign-in for provisioned internal users.'
                : AUTH_CONFIG.mode === 'hybrid'
                  ? 'This environment supports both work-email sign-in and enterprise SSO for provisioned internal users.'
                  : 'This environment requires enterprise SSO for internal users.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {SSO_PROVIDER_ORDER.map((provider) => {
            const enabled = AUTH_CONFIG.ssoEnabled && AUTH_CONFIG.enabledProviders.includes(provider);

            return enabled ? (
              <a
                key={provider}
                href={`/api/auth/sso/${provider}`}
                className="px-4 py-3 rounded-lg text-sm font-semibold text-center"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
              >
                {OPS_SSO_PROVIDER_LABELS[provider]}
              </a>
            ) : (
              <button
                key={provider}
                type="button"
                disabled
                className="px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-100"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
              >
                {OPS_SSO_PROVIDER_LABELS[provider]}
              </button>
            );
          })}
        </div>

        <p className="text-xs mb-5" style={{ color: 'var(--color-muted)' }}>
          {AUTH_CONFIG.ssoEnabled
            ? AUTH_CONFIG.enabledProviders.length > 0
              ? `Configured SSO providers: ${AUTH_CONFIG.enabledProviders.map((provider) => OPS_SSO_PROVIDER_LABELS[provider]).join(', ')}.`
              : 'SSO mode is available, but no provider has been enabled in this environment yet.'
            : 'Enterprise SSO can be turned on later by enabling ops auth mode and provider routes in environment configuration.'}
        </p>

        {error && (
          <div
            className="text-sm px-4 py-3 rounded-lg mb-5"
            style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
          >
            {error}
          </div>
        )}

        {AUTH_CONFIG.emailSignInEnabled ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                Work email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@lender.co.za"
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  background:  'var(--color-surface-2)',
                  border:      '1px solid var(--color-border)',
                  color:       'var(--foreground)',
                  outline:     'none',
                }}
              />
            </div>

            {loading && (
              <div
                className="text-xs px-4 py-3 rounded-lg"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
              >
                Verifying workspace access and opening the internal console…
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div
            className="rounded-lg px-4 py-4 text-sm"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
          >
            Work-email sign-in is disabled in this environment. Use one of the enabled SSO providers above.
          </div>
        )}

        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
            Forgot your access or need to be added to the workspace?
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <a href="mailto:support@capstack.co.za?subject=Ops%20workspace%20access" style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
              Contact workspace admin
            </a>
            <Link href="/" style={{ color: 'var(--color-muted)' }}>
              Back to platform
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getReasonMessage(reason: string, provider: string | null): string {
  const providerLabel = provider && (provider === 'google' || provider === 'microsoft')
    ? OPS_SSO_PROVIDER_LABELS[provider]
    : 'Enterprise SSO';

  switch (reason) {
    case 'session_expired':
      return 'Your ops session expired. Sign in again to continue.';
    case 'auth_required':
      return 'Sign in to access the ops workspace.';
    case 'sso_provider_denied':
      return `${providerLabel} sign-in was cancelled or denied.`;
    case 'sso_state_invalid':
      return 'The SSO sign-in attempt expired or could not be verified. Please try again.';
    case 'sso_exchange_failed':
      return `${providerLabel} completed, but the authorization code exchange failed.`;
    case 'sso_profile_failed':
      return `${providerLabel} completed, but your verified work profile could not be retrieved.`;
    case 'sso_access_denied':
      return 'Your identity provider authenticated you, but no provisioned Capstack staff account was found for that email.';
    case 'sso_provider_not_configured':
      return `${providerLabel} is enabled in the UI but not fully configured on the server.`;
    default:
      return 'Sign-in failed. Please try again.';
  }
}
