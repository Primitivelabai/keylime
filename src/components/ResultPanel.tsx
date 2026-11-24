import type { AssertionVerificationResult, StoredPasskeyRecord } from '../lib/rp';
import { CheckIcon, CrossIcon, Lime } from './Brand';
import { shortId } from './steps';

interface ResultPanelProps {
  result: AssertionVerificationResult;
  record: StoredPasskeyRecord | null;
  onOpenInspector: () => void;
}

function CheckBox({ passed, delay }: { passed: boolean; delay: number }) {
  return (
    <span
      aria-hidden="true"
      className="kl-tick"
      style={{
        animationDelay: `${delay}s`,
        flex: 'none',
        width: 18,
        height: 18,
        marginTop: 2,
        background: passed ? 'var(--lime)' : 'var(--bad-bg)',
        border: `2px solid ${passed ? 'var(--hard)' : 'var(--bad)'}`,
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {passed ? <CheckIcon size={10} width={4} color="var(--ink)" /> : <CrossIcon size={10} color="var(--bad)" />}
    </span>
  );
}

/** The verdict after a real sign-in: every check the website ran, pass or fail. */
export function ResultPanel({ result, record, onOpenInspector }: ResultPanelProps) {
  const total = result.checks.length;
  const passed = result.checks.filter((c) => c.passed).length;
  const failed = total - passed;
  const signCount = result.parsedAuthData.signCount;

  return (
    <div style={{ position: 'relative', paddingTop: 52 }}>
      <div
        aria-hidden="true"
        className="hidden sm:block"
        style={{ position: 'absolute', top: 0, right: 120, height: 56, overflow: 'hidden', width: 80 }}
      >
        <div className="kl-peek">
          <Lime width={70} />
        </div>
      </div>
      <section
        aria-labelledby="result-heading"
        aria-live="assertive"
        className="kl-card kl-in"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <div
          className="flex items-center justify-between flex-wrap"
          style={{
            gap: 16,
            padding: '24px 28px',
            background: result.valid ? 'var(--lime)' : 'var(--bad-bg)',
            borderBottom: '2px solid var(--hard)',
          }}
        >
          <div className="flex items-center" style={{ gap: 16 }}>
            {result.valid ? (
              <CheckIcon size={30} width={2.25} color="var(--ink)" />
            ) : (
              <CrossIcon size={30} color="var(--bad)" />
            )}
            <div>
              <h2
                id="result-heading"
                className="kl-display"
                style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 32px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
              >
                {result.valid ? `Signed in as ${record?.username ?? 'you'}` : 'Sign-in rejected'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 15 }}>
                {result.valid
                  ? `Verified with the passkey you just used${record ? ` · credential ${shortId(record.id, 3, 3)} · ${record.algorithmName}` : ''}`
                  : `${failed} of ${total} checks failed.`}
              </p>
            </div>
          </div>
          <span
            className="kl-label"
            style={{
              color: 'var(--ink)',
              fontSize: 12,
              border: '2px solid var(--ink)',
              borderRadius: 6,
              padding: '4px 10px',
            }}
          >
            {passed} / {total} checks
          </span>
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '8px 28px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            columnGap: 48,
          }}
        >
          {result.checks.map((chk, i) => (
            <li
              key={chk.id}
              className="flex"
              style={{ gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)' }}
            >
              <CheckBox passed={chk.passed} delay={0.3 + i * 0.12} />
              <span>
                <span style={{ fontWeight: 500, color: chk.passed ? 'var(--ink)' : 'var(--bad)' }}>{chk.label}</span>
                <br />
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  {chk.passed ? chk.explanation : `Got ${chk.actual}, expected ${chk.expected}.`}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between items-center flex-wrap" style={{ gap: 16, padding: '18px 28px 26px' }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            {signCount === 0
              ? "Sign count 0. This authenticator doesn't count, so we don't rely on it."
              : `Sign count ${signCount}. It has to go up every time.`}
          </span>
          <div className="flex flex-wrap" style={{ gap: 12 }}>
            <button type="button" className="kl-btn kl-btn--md" onClick={onOpenInspector}>
              Open inspector
            </button>
            <a href="#break" className="kl-btn kl-btn--md kl-btn--lime">
              Now try to break it →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
