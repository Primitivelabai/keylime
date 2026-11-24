import type { PasskeyLab, Phase } from '../hooks/usePasskeyLab';
import { STEPS } from './steps';

/** The result of the last step, once a ceremony has reached it. */
function outcome(lab: PasskeyLab, phase: Phase): { text: string; ok: boolean } | null {
  if (lab.trace?.phase !== phase || lab.highlightedStepIdx < 3) return null;
  if (phase === 'register') return lab.storedRecord ? { text: 'Saved', ok: true } : null;
  const result = lab.lastAssertionResult;
  if (!result) return null;
  const passed = result.checks.filter((c) => c.passed).length;
  return { text: `${passed} of ${result.checks.length} checks pass`, ok: result.valid };
}

/** "How it works": the four steps of the current ceremony, lit up as they happen. */
export function Exchange({ lab }: { lab: PasskeyLab }) {
  const phase = lab.flowPhase;
  const steps = STEPS[phase];
  const done = outcome(lab, phase);

  const choosePhase = (p: Phase) => {
    lab.setFlowPhase(p);
    lab.setHighlightedStepIdx(lab.trace?.phase === p ? 3 : -1);
  };

  return (
    <section aria-labelledby="exchange-heading" className="flex flex-col" style={{ gap: 20 }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 16 }}>
        <h2
          id="exchange-heading"
          className="kl-display"
          style={{ margin: 0, fontSize: 'clamp(26px, 4vw, 36px)', letterSpacing: '-0.03em' }}
        >
          How {phase === 'signin' ? 'sign in' : 'create'} works
        </h2>
        <div
          role="group"
          aria-label="Which ceremony"
          className="inline-flex"
          style={{ border: '2px solid var(--hard)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}
        >
          {(['register', 'signin'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={phase === p}
              onClick={() => choosePhase(p)}
              style={{
                height: 38,
                padding: '0 16px',
                border: 0,
                background: phase === p ? 'var(--lime)' : 'transparent',
                color: phase === p ? 'var(--ink)' : 'var(--ink-2)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {p === 'register' ? 'Create' : 'Sign in'}
            </button>
          ))}
        </div>
      </div>

      <ol
        aria-live="polite"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: 12,
        }}
      >
        {steps.map((step, idx) => {
          const on = lab.flowPhase === phase && idx <= lab.highlightedStepIdx;
          const last = idx === steps.length - 1;
          return (
            <li
              key={`${phase}-${idx}`}
              className="kl-card flex flex-col"
              style={{
                padding: 22,
                gap: 10,
                background: on ? 'var(--lime)' : 'var(--surface)',
                transition: 'background .3s',
              }}
            >
              <span className="kl-micro">
                {String(idx + 1).padStart(2, '0')} · {step.side === 'device' ? 'Your device' : 'The website'}
              </span>
              <strong className="kl-display" style={{ fontSize: 19, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                {step.title}
              </strong>
              <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                {last && done ? (
                  <span style={{ fontWeight: 600, color: done.ok ? 'var(--ink)' : 'var(--bad)' }}>{done.text}</span>
                ) : (
                  step.detail
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
