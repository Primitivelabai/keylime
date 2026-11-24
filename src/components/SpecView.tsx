import { useCallback, useEffect, useState } from 'react';
import { type SpecTestCaseResult, runWebAuthnSpecUnitTests } from '../lib/specTests';
import { CheckIcon, CrossIcon } from './Brand';

const COLS = '48px minmax(0, 1.1fr) minmax(0, 1.4fr) 150px';

interface Run {
  results: SpecTestCaseResult[];
  finishedAt: Date;
  totalMs: number;
}

/** Spec tests: real keys and signatures made with WebCrypto, checked by the same code the playground uses. */
export function SpecView() {
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);

  const execute = useCallback(async () => {
    setRunning(true);
    const start = performance.now();
    const results = await runWebAuthnSpecUnitTests();
    setRun({ results, finishedAt: new Date(), totalMs: Math.round(performance.now() - start) });
    setRunning(false);
  }, []);

  useEffect(() => {
    execute();
  }, [execute]);

  const results = run?.results ?? [];
  const passed = results.filter((r) => r.passed).length;
  const allPass = results.length > 0 && passed === results.length;

  return (
    <div className="flex flex-col" style={{ gap: 40 }}>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: '32px 64px',
          alignItems: 'end',
        }}
      >
        <div className="flex flex-col" style={{ gap: 16 }}>
          <span className="kl-micro">Spec tests · run in this browser</span>
          <h1
            className="kl-display"
            style={{
              margin: 0,
              fontSize: 'clamp(38px, 6vw, 56px)',
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
              maxWidth: '15ch',
            }}
          >
            Real keys, real signatures, checked <span className="kl-hl">here.</span>
          </h1>
        </div>
        <div className="flex flex-col" style={{ gap: 16 }}>
          <p style={{ margin: 0, maxWidth: '52ch', color: 'rgba(43,36,32,.72)' }}>
            Each test uses real test vectors or makes its own key with the browser's crypto, signs, and checks the
            result with the same parsers and verifier the playground uses. No passkey prompt, no network.
          </p>
          <div className="flex items-center flex-wrap" style={{ gap: 12 }} aria-live="polite">
            <button
              type="button"
              className="kl-btn kl-btn--md kl-btn--lime kl-btn--mono"
              onClick={execute}
              disabled={running}
            >
              {running ? 'Running…' : `Run all ${results.length || ''}`.trim()}
            </button>
            {run && (
              <>
                <span
                  className="inline-flex items-center"
                  style={{ fontSize: 13, gap: 8, color: allPass ? 'var(--ok)' : 'var(--bad)' }}
                >
                  {allPass ? <CheckIcon /> : <CrossIcon />}
                  {passed} of {results.length} pass
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  · {run.finishedAt.toLocaleTimeString()} · {run.totalMs} ms
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Test results" className="kl-card" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 760 }}>
          <div
            className="kl-micro"
            style={{
              display: 'grid',
              gridTemplateColumns: COLS,
              gap: 16,
              padding: '14px 24px',
              borderBottom: '1px solid rgba(43,36,32,.14)',
            }}
          >
            <span>#</span>
            <span>Test</span>
            <span>What it checked</span>
            <span>Result</span>
          </div>
          {results.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: 'grid',
                gridTemplateColumns: COLS,
                gap: 16,
                alignItems: 'center',
                padding: '14px 24px',
                borderBottom: i < results.length - 1 ? '1px solid rgba(43,36,32,.10)' : undefined,
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--ink-3)' }}>{String(i + 1).padStart(2, '0')}</span>
              <span className="flex flex-col">
                <span>{t.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{t.specRef}</span>
              </span>
              <span style={{ color: 'var(--ink-3)', overflowWrap: 'anywhere' }}>{t.details}</span>
              <span
                className="inline-flex items-center"
                style={{ gap: 8, color: t.passed ? 'var(--ok)' : 'var(--bad)' }}
              >
                {t.passed ? <CheckIcon /> : <CrossIcon />}
                {t.passed ? 'Pass' : 'Fail'} · {t.durationMs} ms
              </span>
            </div>
          ))}
          {results.length === 0 && (
            <p style={{ margin: 0, padding: '18px 24px', fontSize: 13, color: 'var(--ink-3)' }}>Running…</p>
          )}
        </div>
      </section>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>
        One real passkey on a real device is still the final check.
      </p>
    </div>
  );
}
