import type { ReactNode } from 'react';
import { StillLife } from './StillLife';

const REAL = 'login.example.com';
const FAKE = 'login.examp1e.com';

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function BrowserFrame({ host, children }: { host: ReactNode; children: ReactNode }) {
  return (
    <div className="kl-card" style={{ overflow: 'hidden', boxShadow: '0 1px 2px rgba(43,36,32,.05)' }}>
      <div
        style={{ padding: '10px 12px', borderBottom: '1px solid rgba(43,36,32,.10)', background: 'rgba(43,36,32,.04)' }}
      >
        <div
          className="flex items-center"
          style={{
            gap: 8,
            height: 30,
            padding: '0 12px',
            background: 'var(--surface)',
            border: '1px solid rgba(43,36,32,.14)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <LockIcon />
          <span style={{ color: 'var(--ink-3)' }}>https://</span>
          <span>{host}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

const field = { width: '100%', maxWidth: 260, height: 32, borderRadius: 6, boxSizing: 'border-box' as const };

function FakeLogin({ filled }: { filled?: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ padding: 28, gap: 10 }} aria-hidden="true">
      {!filled && (
        <span className="kl-display" style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
          Example
        </span>
      )}
      {filled ? (
        <>
          <span
            className="flex items-center"
            style={{ ...field, border: '1px solid rgba(43,36,32,.28)', padding: '0 10px', fontSize: 12 }}
          >
            pol
          </span>
          <span
            className="flex items-center"
            style={{
              ...field,
              border: '1px solid var(--hard)',
              padding: '0 10px',
              fontSize: 14,
              letterSpacing: '.1em',
            }}
          >
            ••••••••••
          </span>
          <span
            className="flex items-center justify-center"
            style={{
              ...field,
              background: 'var(--lime)',
              border: '2px solid var(--hard)',
              boxShadow: '3px 3px 0 var(--hard)',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Sign in
          </span>
        </>
      ) : (
        <>
          <span style={{ ...field, border: '1px solid rgba(43,36,32,.18)' }} />
          <span style={{ ...field, border: '1px solid rgba(43,36,32,.18)' }} />
          <span style={{ ...field, background: 'rgba(43,36,32,.14)' }} />
        </>
      )}
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <figcaption style={{ fontSize: 13, color: 'rgba(43,36,32,.72)' }}>{children}</figcaption>;
}

function Row({ num, title, quote, children }: { num: string; title: string; quote?: string; children: ReactNode }) {
  return (
    <section className="kl-phish-row" aria-labelledby={`phish-${num}`}>
      <div className="flex flex-col" style={{ gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{num}</span>
        <h2
          id={`phish-${num}`}
          className="kl-display"
          style={{ margin: 0, fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1.1 }}
        >
          {title}
        </h2>
        {quote && <p style={{ margin: 0, fontSize: 13, color: 'rgba(43,36,32,.72)' }}>{quote}</p>}
      </div>
      {children}
    </section>
  );
}

function Track({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <span className="kl-micro kl-phish-track">{label}</span>
      {children}
    </div>
  );
}

/** The phishing story: the same fake page, once with a password and once with a passkey. */
export function PhishingView() {
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
          <span className="kl-micro">Phishing story · three steps</span>
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
            Same fake page. Two very different <span className="kl-hl">endings.</span>
          </h1>
        </div>
        <p style={{ margin: 0, maxWidth: '52ch', color: 'rgba(43,36,32,.72)' }}>
          A password is a secret you type, so it works wherever you type it. A passkey is tied to the site's address by
          the browser, so on the wrong address there is nothing to give away.
        </p>
      </section>

      <div className="kl-phish-head kl-micro" aria-hidden="true">
        <span />
        <span>With a password</span>
        <span>With a passkey</span>
      </div>

      <Row num="01" title="A link arrives" quote={'"Your account is locked. Sign in to fix it."'}>
        <Track label="With a password">
          <figure className="flex flex-col" style={{ margin: 0, gap: 12 }}>
            <BrowserFrame
              host={
                <>
                  login.examp<span style={{ background: 'var(--lime)', padding: '0 1px' }}>1</span>e.com
                </>
              }
            >
              <FakeLogin />
            </BrowserFrame>
            <Caption>A pixel-perfect copy. The only tell is one character in the address.</Caption>
          </figure>
        </Track>
        <Track label="With a passkey">
          <figure className="flex flex-col" style={{ margin: 0, gap: 12 }}>
            <BrowserFrame host={FAKE}>
              <FakeLogin />
            </BrowserFrame>
            <Caption>Same page, same trap. So far nothing is different.</Caption>
          </figure>
        </Track>
      </Row>

      <Row num="02" title="You try to sign in">
        <Track label="With a password">
          <figure className="flex flex-col" style={{ margin: 0, gap: 12 }}>
            <BrowserFrame host={FAKE}>
              <FakeLogin filled />
            </BrowserFrame>
            <Caption>You type it. The fake page now has it, in plain text.</Caption>
          </figure>
        </Track>
        <Track label="With a passkey">
          <figure className="flex flex-col" style={{ margin: 0, gap: 12 }}>
            <BrowserFrame host={FAKE}>
              <div className="flex justify-center" style={{ padding: 28 }}>
                <div
                  className="flex flex-col"
                  style={{
                    width: '100%',
                    maxWidth: 300,
                    border: '1px solid rgba(43,36,32,.18)',
                    borderRadius: 12,
                    padding: 18,
                    gap: 8,
                    boxShadow: '0 0 0 1px rgba(43,36,32,.08), 0 12px 32px rgba(43,36,32,.10)',
                  }}
                >
                  <span className="kl-micro">Browser</span>
                  <strong className="kl-display" style={{ fontSize: 16 }}>
                    No passkeys for this site
                  </strong>
                  <span style={{ fontSize: 12, color: 'rgba(43,36,32,.72)' }}>{FAKE}</span>
                </div>
              </div>
            </BrowserFrame>
            <Caption>
              Your passkey belongs to {REAL}. The browser won't offer it anywhere else, and you can't hand it over.
            </Caption>
          </figure>
        </Track>
      </Row>

      <Row num="03" title="What the attacker gets">
        <Track label="With a password">
          <div className="flex flex-col" style={{ gap: 12 }}>
            <BrowserFrame host={REAL}>
              <div className="kl-notice" data-tone="bad" style={{ padding: '18px 22px', gap: 4 }}>
                <strong style={{ fontSize: 16 }}>Signed in as pol</strong>
                <span style={{ fontSize: 13, color: 'rgba(43,36,32,.72)' }}>
                  The attacker, on the real site, with your password.
                </span>
              </div>
            </BrowserFrame>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(43,36,32,.72)' }}>
              A working password. It goes on working until you notice and change it.
            </p>
          </div>
        </Track>
        <Track label="With a passkey">
          <div className="flex flex-col" style={{ gap: 12 }}>
            <BrowserFrame host={REAL}>
              <div className="flex flex-col" style={{ padding: '18px 22px', gap: 4, background: 'var(--lime)' }}>
                <strong className="kl-display" style={{ fontSize: 16 }}>
                  Sign-in rejected
                </strong>
                <span style={{ fontSize: 13, color: 'rgba(43,36,32,.72)' }}>
                  Origin was {FAKE}. Expected {REAL}.
                </span>
              </div>
            </BrowserFrame>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(43,36,32,.72)' }}>
              Nothing usable. Even if they trick a device into signing, the browser writes the fake address into what's
              signed, and the real site checks it.
            </p>
          </div>
        </Track>
      </Row>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: 56,
          alignItems: 'center',
          padding: '24px 0',
        }}
      >
        <StillLife tilt={2} />
        <div className="flex flex-col" style={{ gap: 16 }}>
          <span className="kl-eyebrow">The moral</span>
          <h2
            className="kl-display"
            style={{ margin: 0, fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '-0.03em', lineHeight: 1.04 }}
          >
            A fake stall can copy the fruit. <span className="kl-hl">Not the address</span>.
          </h2>
          <p style={{ margin: 0, maxWidth: '44ch', color: 'rgba(43,36,32,.8)' }}>
            A look-alike page can copy every pixel. It can't change the address your browser writes into a passkey
            signature.
          </p>
        </div>
      </section>

      <div
        className="flex justify-between items-center flex-wrap"
        style={{ gap: 16, borderTop: '1px solid rgba(43,36,32,.14)', paddingTop: 24 }}
      >
        <span style={{ color: 'rgba(43,36,32,.72)' }}>See the origin check fail for real.</span>
        <a href="#break" className="kl-btn kl-btn--sm kl-btn--lime">
          Run the phishing attack →
        </a>
      </div>
    </div>
  );
}
