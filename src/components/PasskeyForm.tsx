import type React from 'react';
import { useEffect, useState } from 'react';
import type { EnvironmentCapabilities } from '../hooks/useEnvironment';
import type { PasskeyLab } from '../hooks/usePasskeyLab';
import { CheckIcon, Lime } from './Brand';
import { STEPS } from './steps';

function useCountdown(deadline: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [deadline]);
  if (deadline === null) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function FrameNotice({ env }: { env: EnvironmentCapabilities }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div role="alert" className="flex flex-col gap-3">
      <div className="kl-notice" data-tone="warn">
        <strong>
          {env.iframePolicyBlocked ? "Passkeys can't run inside this frame" : 'This page is inside a frame'}
        </strong>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          This page is embedded in another site, and browsers block passkeys there unless the site allows it. Open it in
          its own tab to create a passkey or sign in. The phishing story and spec tests still work here.
        </span>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          className="kl-btn kl-btn--lime kl-btn--md"
          onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
        >
          Open in new tab
        </button>
        <button
          type="button"
          onClick={copy}
          style={{
            border: 0,
            background: 'none',
            padding: 0,
            color: 'var(--link)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}

function Waiting({ lab, env }: { lab: PasskeyLab; env: EnvironmentCapabilities }) {
  const left = useCountdown(lab.deadline);
  const phase = lab.busyPhase ?? 'register';
  const labels = ['Challenge made', 'Waiting for you', phase === 'register' ? 'Make the key' : 'Sign', 'Check'];
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <strong className="kl-display" style={{ fontSize: 22, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          Confirm in {env.platformName}
        </strong>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          Your device is asking. Nothing is {phase === 'register' ? 'created' : 'signed'} until you confirm.
        </span>
      </div>
      <ol className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8, fontSize: 13 }}>
        {labels.map((label, i) => {
          const done = i < Math.max(1, lab.highlightedStepIdx);
          const current = !done && i === Math.max(1, lab.highlightedStepIdx);
          return (
            <li
              key={label}
              className="flex items-center gap-2.5"
              style={{ color: done || current ? 'var(--ink)' : 'var(--ink-3)', fontWeight: current ? 500 : 400 }}
            >
              {done ? (
                <CheckIcon color="var(--ok)" />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 15,
                    height: 15,
                    boxSizing: 'border-box',
                    borderRadius: '50%',
                    border: current ? '2px solid var(--warn-line)' : '1px solid rgba(43,36,32,.28)',
                  }}
                />
              )}
              {String(i + 1).padStart(2, '0')} {label}
              {current && i === 1 && left && ` · ${left} left`}
            </li>
          );
        })}
      </ol>
      <div>
        <button
          type="button"
          className="kl-btn kl-btn--md kl-btn--mono"
          onClick={lab.cancel}
          disabled={lab.deadline === null}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResetExplainer({ rpId, onDismiss }: { rpId: string; onDismiss: () => void }) {
  return (
    <div role="status" className="kl-notice" style={{ fontSize: 13 }}>
      <div className="flex items-start justify-between gap-3">
        <strong>The website forgot your public key</strong>
        <button
          type="button"
          onClick={onDismiss}
          style={{ border: 0, background: 'none', color: 'var(--link)', cursor: 'pointer', fontSize: 13 }}
        >
          Dismiss
        </button>
      </div>
      <span style={{ color: 'var(--ink-2)' }}>
        The passkey itself is still on your device: websites aren't allowed to delete it. To remove it, search for{' '}
        <code>{rpId}</code> in:
      </span>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)' }}>
        <li>Windows: Settings → Accounts → Passkeys</li>
        <li>macOS or iOS: the Passwords app</li>
        <li>
          Chrome or Edge: <code>chrome://password-manager/passwords</code>
        </li>
      </ul>
    </div>
  );
}

interface PasskeyFormProps {
  lab: PasskeyLab;
  env: EnvironmentCapabilities;
}

/** The hero card: username, Create passkey, Sign in with passkey, and every state around them. */
export function PasskeyForm({ lab, env }: PasskeyFormProps) {
  const { busyPhase, ceremonyError, storedRecord } = lab;
  const blocked = env.isIframe || env.iframePolicyBlocked;
  const busy = busyPhase !== null;
  const name = lab.username.trim() || 'pol';

  let status: React.ReactNode = null;
  if (busy) {
    status = <Waiting lab={lab} env={env} />;
  } else if (!env.webAuthnSupported) {
    status = (
      <div role="alert" className="kl-notice">
        <strong>This browser can't make passkeys</strong>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          WebAuthn isn't available here. A recent Chrome, Edge, Safari or Firefox will work.{' '}
          <a href="#phishing">Read the phishing story →</a>
        </span>
      </div>
    );
  } else if (blocked) {
    status = <FrameNotice env={env} />;
  } else if (ceremonyError?.kind === 'cancelled') {
    status = (
      <div role="alert" className="flex flex-col gap-3">
        <div className="kl-notice">
          <strong>
            Cancelled or timed out. Nothing was {ceremonyError.phase === 'register' ? 'created' : 'signed'}.
          </strong>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            The prompt was closed or waited too long. No key was {ceremonyError.phase === 'register' ? 'made' : 'used'}{' '}
            and nothing was sent. Start again for a fresh challenge.
          </span>
        </div>
        <div>
          <button
            type="button"
            className="kl-btn kl-btn--md kl-btn--mono"
            onClick={() => (ceremonyError.phase === 'register' ? lab.register() : lab.signIn())}
          >
            Try again
          </button>
        </div>
      </div>
    );
  } else if (ceremonyError) {
    status = (
      <div role="alert" className="kl-notice" data-tone="bad">
        <strong>That didn't work</strong>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>{ceremonyError.message}</span>
      </div>
    );
  } else if (lab.resetNotice) {
    status = <ResetExplainer rpId={env.rpId} onDismiss={lab.dismissResetNotice} />;
  }

  return (
    <div style={{ position: 'relative', padding: '0 14px 14px 0' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '14px 0 0 14px',
          background: 'var(--lime)',
          borderRadius: 14,
          border: '2px solid var(--hard)',
        }}
      />
      <form
        onSubmit={lab.register}
        aria-label="Passkey registration and sign-in"
        className="kl-card flex flex-col"
        style={{ position: 'relative', gap: 14, padding: 'clamp(20px, 4vw, 32px)' }}
      >
        <div
          aria-hidden="true"
          className="kl-hop hidden sm:block"
          style={{ position: 'absolute', top: -62, right: 28 }}
        >
          <Lime width={70} />
        </div>
        <label htmlFor="passkey-username" className="kl-label">
          Username
        </label>
        <input
          id="passkey-username"
          type="text"
          value={lab.username}
          onChange={(e) => lab.setUsername(e.target.value)}
          autoComplete="username webauthn"
          disabled={busy}
          style={{
            height: 48,
            padding: '0 14px',
            border: '1.5px solid var(--line-2)',
            borderRadius: 8,
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            color: 'var(--ink)',
            background: 'var(--surface)',
            boxSizing: 'border-box',
          }}
        />
        <div className="flex flex-col sm:flex-row flex-wrap" style={{ gap: 12, marginTop: 6 }}>
          <button type="submit" className="kl-btn kl-btn--lime" disabled={busy || !env.webAuthnSupported}>
            {busyPhase === 'register' ? 'Creating on device…' : 'Create passkey'}
          </button>
          <button type="button" className="kl-btn" disabled={!storedRecord || busy} onClick={lab.signIn}>
            {busyPhase === 'signin' ? 'Signing…' : 'Sign in with passkey'}
          </button>
        </div>

        {status}

        {!busy && (
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>
            {storedRecord ? (
              <>
                Passkey saved for{' '}
                <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>{storedRecord.username}</strong>.{' '}
                <button
                  type="button"
                  onClick={lab.reset}
                  style={{
                    border: 0,
                    background: 'none',
                    padding: 0,
                    color: 'var(--link)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  Forget it
                </button>
              </>
            ) : env.webAuthnSupported && !blocked ? (
              <>Create a passkey first, then sign in.</>
            ) : null}
          </p>
        )}
      </form>
    </div>
  );
}
