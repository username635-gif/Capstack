'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { MeshPatternOverlay } from './MeshPatternOverlay';

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

type InteractiveMeshSurfaceProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  lightBackground: string;
  darkBackground: string;
};

export function InteractiveMeshSurface({
  children,
  className,
  contentClassName,
  style,
  contentStyle,
  lightBackground,
  darkBackground,
}: InteractiveMeshSurfaceProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef(OFFSCREEN_MOUSE);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

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

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: themeMode === 'dark' ? darkBackground : lightBackground,
        ...style,
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

      <div className={contentClassName ?? 'relative z-10'} style={contentStyle}>
        {children}
      </div>
    </div>
  );
}