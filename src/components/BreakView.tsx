import type { AttackMode, PasskeyLab } from '../hooks/usePasskeyLab';
import type { AssertionVerificationResult } from '../lib/rp';
import { CheckIcon, CrossIcon } from './Brand';

interface Attack {
  mode: AttackMode;
  title: string;
  summary: string;
  change: string;
}

const ATTACKS: Attack[] = [
  {
    mode: 'swap-origin',
    title: 'Phishing origin',
    summary: 'Sign on a look-alike site, then pass the response to the real one.',
    change: 'origin → https://evil-login-phish.example',
  },
  {
    mode: 'flip-challenge-byte',
    title: 'Flipped challenge',
    summary: 'Flip the first byte of the challenge after it was signed.',
    change: 'challenge[0] ^= 0xff',
  },
  {
    mode: 'replay-old-assertion',
    title: 'Replay',
    summary: 'Send the same signed response again, after the website has issued a new challenge.',
    change: 'nothing · we just resend it',
  },
  {
    mode: 'wrong-public-key',
    title: 'Wrong key',
    summary: "Check the signature against a different passkey's public key.",
    change: 'stored key → a freshly made one',
  },
];

function Counter({ label, value, dark, blink }: { label: string; value: string; dark?: boolean; blink?: boolean }) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: 2,
        padding: '12px 18px',
        background: dark ? 'var(--ink)' : 'var(--surface)',
        color: dark ? 'var(--lime)' : 'var(--ink)',
        borderLeft: dark ? undefined : '2px solid var(--hard)',
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: '.18em', color: dark ? undefined : 'rgba(43,36,32,.7)' }}>
        {label}
      </span>
      <span style={{ fontSize: 34, fontWeight: dark ? 500 : 400, letterSpacing: '.08em', lineHeight: 1 }}>
        {value}
        {blink && <span className="kl-blink">_</span>}
      </span>
    </div>
  );
}

function StatusChip({ result }: { result?: AssertionVerificationResult }) {
  if (!result) return null;
  const blocked = !result.valid;
  return (
    <span
      className="kl-micro inline-flex items-center"
      style={{
        gap: 8,
        borderRadius: 999,
        padding: '5px 12px 5px 10px',
        background: blocked ? 'var(--hard)' : 'var(--stamp)',
        color: blocked ? 'var(--lime)' : '#fff',
      }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: 'currentColor' }} />
      {blocked ? 'Blocked' : 'Got through'}
    </span>
  );
}

/** One square per check the website ran; the ones that caught the attack are filled. */
function CheckStrip({ result }: { result: AssertionVerificationResult }) {
  return (
    <ol
      aria-label="Checks the website ran"
      className="flex"
      style={{ listStyle: 'none', margin: 0, padding: 0, gap: 4 }}
    >
      {result.checks.map((c) => (
        <li
          key={c.id}
          title={`${c.label}: ${c.passed ? 'passed' : 'failed'}`}
          aria-label={`${c.label}: ${c.passed ? 'passed' : 'failed'}`}
          className="flex items-center justify-center"
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            border: '1.5px solid var(--hard)',
            background: c.passed ? 'transparent' : 'var(--hard)',
            color: c.passed ? 'var(--ok)' : 'var(--lime)',
          }}
        >
          {c.passed ? <CheckIcon size={11} /> : <CrossIcon size={11} />}
        </li>
      ))}
    </ol>
  );
}

/** Shows where `got` first differs from `expected`, when the two are close enough to compare. */
function Diff({ expected, actual }: { expected: string; actual: string }) {
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
  const comparable = i >= 2 || (expected.length > 6 && expected.slice(1) === actual.slice(1));
  const row = (label: string, value: string, mark: boolean) => (
    <>
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ overflowWrap: 'anywhere' }}>
        {mark && comparable ? (
          <>
            {value.slice(0, i)}
            <mark style={{ background: 'var(--lime)', color: 'var(--hard)', padding: '0 1px' }}>{value[i]}</mark>
            <span style={{ color: 'var(--ink-3)' }}>{value.slice(i + 1)}</span>
          </>
        ) : (
          value
        )}
      </span>
    </>
  );
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr',
        gap: '4px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      {row('expected', expected, false)}
      {row('got', actual, true)}
    </div>
  );
}

function Outcome({ result }: { result: AssertionVerificationResult }) {
  const failed = result.checks.filter((c) => !c.passed);
  return (
    <div className="flex flex-col" style={{ gap: 14, borderTop: '1px solid rgba(43,36,32,.10)', paddingTop: 16 }}>
      <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          {result.valid
            ? 'Every check passed. That is a bug; please tell us how.'
            : `Caught by ${failed.length} of ${result.checks.length} checks`}
        </span>
        <CheckStrip result={result} />
      </div>
      {failed.map((c) => (
        <div
          key={c.id}
          className="flex flex-col"
          style={{ gap: 8, padding: '12px 14px', borderRadius: 8, background: 'rgba(43,36,32,.04)' }}
        >
          <strong style={{ fontSize: 14 }}>{c.label}</strong>
          <Diff expected={c.expected} actual={c.actual} />
        </div>
      ))}
    </div>
  );
}

interface AttackCardProps {
  attack: Attack;
  result?: AssertionVerificationResult;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
  onInspect: () => void;
}

function AttackCard({ attack, result, running, disabled, onRun, onInspect }: AttackCardProps) {
  return (
    <article
      aria-labelledby={`attack-${attack.mode}`}
      className="kl-card flex flex-col"
      style={{ position: 'relative', padding: 28, gap: 16 }}
    >
      <div className="flex justify-between items-start" style={{ gap: 12 }}>
        <h2
          id={`attack-${attack.mode}`}
          className="kl-display"
          style={{ margin: 0, fontSize: 24, letterSpacing: '-0.03em' }}
        >
          {attack.title}
        </h2>
        <StatusChip result={result} />
      </div>
      <p style={{ margin: 0, color: 'var(--ink-2)' }}>{attack.summary}</p>
      <code style={{ alignSelf: 'flex-start', fontSize: 12, overflowWrap: 'anywhere', color: 'var(--ink-3)' }}>
        {attack.change}
      </code>
      {result && <Outcome result={result} />}
      <div className="flex items-center" style={{ gap: 10 }}>
        <button
          type="button"
          className={`kl-btn kl-btn--sm kl-btn--mono${result ? '' : ' kl-btn--lime'}`}
          disabled={disabled}
          onClick={onRun}
        >
          {running ? 'Running…' : result ? 'Run again' : 'Run attack'}
        </button>
        {result && (
          <button
            type="button"
            onClick={onInspect}
            style={{
              height: 40,
              padding: '0 4px',
              border: 0,
              background: 'none',
              color: 'var(--link)',
              textDecoration: 'underline',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            See the bytes →
          </button>
        )}
      </div>
    </article>
  );
}

interface BreakViewProps {
  lab: PasskeyLab;
  onInspect: (result: AssertionVerificationResult) => void;
}

/** "Try to break it": real tamper experiments on a copy of the last real sign-in. */
export function BreakView({ lab, onInspect }: BreakViewProps) {
  const results = ATTACKS.map((a) => lab.attackResults[a.mode]).filter((r): r is AssertionVerificationResult => !!r);
  const held = results.filter((r) => !r.valid).length;
  const through = results.length - held;
  const ready = !!lab.lastAssertionBundle;

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
          <span className="kl-micro">Try to break it</span>
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
            Change one thing. Watch it get <span className="kl-hl">rejected.</span>
          </h1>
        </div>
        <div className="flex flex-col" style={{ gap: 14 }}>
          <p style={{ margin: 0, maxWidth: '52ch', color: 'rgba(43,36,32,.72)' }}>
            Each attack takes your last real sign-in, edits one part of it, and hands it to the website. A rejection is
            the defence working. If one ever gets through, that is a bug, and we want to hear about it.
          </p>
          <div
            role="status"
            aria-label={`Defences held ${held}, run ${results.length} of ${ATTACKS.length}, got through ${through}`}
            className="inline-flex self-start"
            style={{
              border: '2px solid var(--hard)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '4px 4px 0 var(--hard)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Counter dark blink label="DEFENCES HELD" value={String(held).padStart(3, '0')} />
            <Counter label="RUN" value={`${results.length}/${ATTACKS.length}`} />
            <Counter label="GOT THROUGH" value={String(through).padStart(3, '0')} />
          </div>
        </div>
      </section>

      {!ready && (
        <div className="kl-notice" role="status">
          <strong>Needs one real sign-in first</strong>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            {lab.storedRecord ? (
              <>
                Go to <a href="#">Play</a> and sign in with your passkey, then come back.
              </>
            ) : (
              <>
                Go to <a href="#">Play</a>, create a passkey and sign in with it, then come back.
              </>
            )}
          </span>
        </div>
      )}

      <section
        aria-label="Attacks"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {ATTACKS.map((attack) => {
          const result = lab.attackResults[attack.mode];
          return (
            <AttackCard
              key={attack.mode}
              attack={attack}
              result={result}
              running={lab.attackRunning === attack.mode}
              disabled={!ready || lab.attackRunning !== null || lab.busyPhase !== null}
              onRun={() => lab.runAttack(attack.mode)}
              onInspect={() => result && onInspect(result)}
            />
          );
        })}
      </section>
    </div>
  );
}
