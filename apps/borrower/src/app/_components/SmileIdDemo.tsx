'use client';

import { useState } from 'react';

export interface SmileIdDemoResult {
  jobId: string;
  documentRef: string;
  completedAt: string;
  confidence: number;
}

type DemoStage = 'intro' | 'selfie' | 'liveness' | 'document' | 'done';

interface Props {
  onComplete: (result: SmileIdDemoResult) => void;
  initialResult?: SmileIdDemoResult | null;
}

const STAGES: Array<{ key: DemoStage; label: string; hint: string }> = [
  { key: 'selfie', label: 'Selfie capture', hint: 'Borrower aligns face in frame' },
  { key: 'liveness', label: 'Liveness check', hint: 'Borrower blinks and turns slightly' },
  { key: 'document', label: 'ID scan', hint: 'ID document is scanned and matched' },
];

export function SmileIdDemo({ onComplete, initialResult = null }: Props) {
  const [stage, setStage] = useState<DemoStage>(initialResult ? 'done' : 'intro');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SmileIdDemoResult | null>(initialResult);

  function simulate(nextStage: DemoStage, durationMs: number, done?: () => void) {
    setRunning(true);
    window.setTimeout(() => {
      done?.();
      setStage(nextStage);
      setRunning(false);
    }, durationMs);
  }

  function handleAction() {
    if (running) return;

    if (stage === 'intro') {
      setStage('selfie');
      return;
    }

    if (stage === 'selfie') {
      simulate('liveness', 1200);
      return;
    }

    if (stage === 'liveness') {
      simulate('document', 1400);
      return;
    }

    if (stage === 'document') {
      simulate('done', 1300, () => {
        const nextResult = {
          jobId: `smile_demo_${Date.now()}`,
          documentRef: `doc_demo_${Date.now()}`,
          completedAt: new Date().toISOString(),
          confidence: 98,
        };
        setResult(nextResult);
        onComplete(nextResult);
      });
    }
  }

  function resetDemo() {
    setStage('intro');
    setRunning(false);
    setResult(null);
  }

  const activeStage = stage === 'intro' ? 'selfie' : stage;

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="mb-5">
        <div className="text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--color-secondary)' }}>
          Smile ID Demo
        </div>
        <h3 className="text-xl font-bold mb-2">Identity check preview</h3>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          This is the demo version of the future face and document verification flow.
          It shows the borrower journey without calling the live Smile ID service.
        </p>
      </div>

      <div className="grid md:grid-cols-[1.15fr_0.85fr] gap-5 items-start">
        <div
          className="rounded-xl p-4"
          style={{
            background: 'linear-gradient(180deg, rgba(16,185,129,0.08), rgba(14,165,233,0.03))',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
              Camera preview
            </span>
            <span
              className="text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{
                background: stage === 'done' ? 'var(--badge-approved-bg)' : 'var(--color-surface-2)',
                color: stage === 'done' ? 'var(--badge-approved-fg)' : 'var(--color-muted)',
              }}
            >
              {stage === 'done' ? 'Verified' : running ? 'Scanning…' : 'Demo mode'}
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              height: 260,
              borderRadius: 16,
              overflow: 'hidden',
              background: 'radial-gradient(circle at top, rgba(56,189,248,0.18), rgba(15,23,42,0.92))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 22,
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 52,
                left: '50%',
                width: 82,
                height: 82,
                transform: 'translateX(-50%)',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.55)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 138,
                left: '50%',
                width: 118,
                height: 74,
                transform: 'translateX(-50%)',
                borderRadius: '48% 48% 42% 42%',
                border: '2px solid rgba(255,255,255,0.55)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: running ? '48%' : '18%',
                height: 2,
                background: 'rgba(34,211,238,0.95)',
                boxShadow: '0 0 18px rgba(34,211,238,0.7)',
                transition: 'top 0.8s ease',
              }}
            />
            <div style={{ position: 'absolute', left: 18, bottom: 18 }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: '#E2E8F0' }}>
                {stage === 'done'
                  ? 'Face match passed'
                  : activeStage === 'selfie'
                    ? 'Align face in frame'
                    : activeStage === 'liveness'
                      ? 'Blink and hold still'
                      : 'Place ID in frame'}
              </div>
              <div className="text-[11px]" style={{ color: 'rgba(226,232,240,0.75)' }}>
                {stage === 'done'
                  ? `Confidence score: ${result?.confidence ?? 98}%`
                  : 'Preview only — no live camera capture yet'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {STAGES.map((item) => {
            const done = result !== null && item.key !== 'done' && STAGES.findIndex((stageItem) => stageItem.key === item.key) < STAGES.findIndex((stageItem) => stageItem.key === activeStage);
            const current = activeStage === item.key && stage !== 'done';
            const verified = stage === 'done';

            return (
              <div
                key={item.key}
                className="rounded-lg px-4 py-3"
                style={{
                  border: '1px solid var(--color-border)',
                  background: current || verified ? 'var(--color-surface-2)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{item.hint}</div>
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2 py-1 rounded-full"
                    style={{
                      background: verified || done ? 'var(--badge-approved-bg)' : current ? 'rgba(34,197,94,0.12)' : 'var(--color-surface)',
                      color: verified || done ? 'var(--badge-approved-fg)' : current ? '#16A34A' : 'var(--color-muted)',
                    }}
                  >
                    {verified || done ? 'Done' : current ? 'Current' : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })}

          <div className="rounded-lg p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>
              Status
            </div>
            <div className="text-sm font-medium">
              {stage === 'done'
                ? 'Demo verification passed. The borrower can continue.'
                : running
                  ? 'Running the current verification step…'
                  : stage === 'intro'
                    ? 'Ready to start the identity demo.'
                    : `Next action: ${stage === 'selfie' ? 'capture selfie' : stage === 'liveness' ? 'run liveness check' : 'scan ID document'}.`}
            </div>
            {result && (
              <div className="text-xs mt-3" style={{ color: 'var(--color-muted)' }}>
                Demo job ID: {result.jobId}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        {stage !== 'done' ? (
          <button
            onClick={handleAction}
            disabled={running}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-secondary)', color: 'var(--color-secondary-fg)', opacity: running ? 0.7 : 1 }}
          >
            {stage === 'intro'
              ? 'Start demo verification'
              : stage === 'selfie'
                ? 'Capture selfie'
                : stage === 'liveness'
                  ? 'Run liveness check'
                  : 'Scan ID document'}
          </button>
        ) : (
          <button
            onClick={resetDemo}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)', border: '1px solid var(--color-border)' }}
          >
            Run demo again
          </button>
        )}
      </div>
    </div>
  );
}