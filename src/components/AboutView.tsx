import type { ReactNode } from 'react';
import { SOURCE_URL } from './Brand';
import { StillLife } from './StillLife';

const FACTS: { label: string; body: ReactNode }[] = [
  {
    label: 'What it is',
    body: 'A teaching tool. Real WebAuthn calls, real signatures, a verifier small enough to read in one sitting.',
  },
  {
    label: "What it isn't",
    body: 'A production server or a library to copy into one. It skips things a real site needs, like rate limits and account recovery.',
  },
  {
    label: 'Your data',
    body: 'Nothing leaves your device. No analytics, no network calls after the page loads. The passkey you make is scoped to this address.',
  },
  {
    label: 'Clean up',
    body: 'Remove test passkeys in your system settings: Windows Hello, iCloud Keychain or Google Password Manager.',
  },
  {
    label: 'Status',
    body: 'The spec tests pass with software keys. Real-device testing is next. Tell us where it breaks.',
  },
  {
    label: 'Reading',
    body: (
      <span className="flex flex-col" style={{ gap: 4 }}>
        <a href="https://www.w3.org/TR/webauthn-3/" target="_blank" rel="noopener noreferrer">
          W3C Web Authentication, Level 3
        </a>
        <a href="https://passkeys.dev" target="_blank" rel="noopener noreferrer">
          passkeys.dev
        </a>
      </span>
    ),
  },
  { label: 'Made by', body: 'primitive, Perth. Open source under the MIT licence.' },
];

export function AboutView() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
        gap: '48px 80px',
        alignItems: 'start',
      }}
    >
      <section className="flex flex-col" style={{ gap: 20 }}>
        <span className="kl-micro">About</span>
        <h1
          className="kl-display"
          style={{
            margin: 0,
            fontSize: 'clamp(38px, 6vw, 56px)',
            lineHeight: 1.02,
            letterSpacing: '-0.04em',
            maxWidth: '14ch',
          }}
        >
          A place to see passkeys <span className="kl-hl">work.</span>
        </h1>
        <p style={{ margin: 0, maxWidth: '48ch', color: 'rgba(43,36,32,.72)' }}>
          keylime runs both halves of a passkey sign-in in one tab: your real authenticator on one side, a small
          verifier on the other. You can read every message, break them on purpose, and watch the checks catch it.
        </p>
        <p style={{ margin: 0, maxWidth: '48ch', color: 'rgba(43,36,32,.72)' }}>
          We built it because most passkey explainers stop at "it's more secure". This one shows the bytes.
        </p>
        <div className="flex flex-wrap" style={{ gap: 10, marginTop: 8 }}>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="kl-btn kl-btn--md kl-btn--lime">
            View source →
          </a>
          <a href="#" className="kl-btn kl-btn--md">
            Back to the playground
          </a>
        </div>
        <div style={{ marginTop: 28, maxWidth: 460 }}>
          <StillLife tilt={-2.5} />
        </div>
      </section>

      <dl className="flex flex-col" style={{ margin: 0, borderTop: '1px solid rgba(43,36,32,.14)' }}>
        {FACTS.map((fact, i) => (
          <div
            key={fact.label}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(110px, 180px) 1fr',
              gap: 16,
              padding: '20px 0',
              borderBottom: i < FACTS.length - 1 ? '1px solid rgba(43,36,32,.10)' : undefined,
            }}
          >
            <dt className="kl-micro" style={{ paddingTop: 3 }}>
              {fact.label}
            </dt>
            <dd style={{ margin: 0, color: 'rgba(43,36,32,.72)' }}>{fact.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
