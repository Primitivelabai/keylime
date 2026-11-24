import { type ReactNode, useEffect, useRef, useState } from 'react';
import { bytesToBase64Url, bytesToHex, hexToBytes } from '../lib/encoding';
import type { AssertionVerificationResult, RawAssertionBundle, StoredPasskeyRecord } from '../lib/rp';
import { type ParsedAuthenticatorData, derToP1363, parseAuthenticatorData } from '../lib/webauthn';
import { CheckIcon } from './Brand';
import { shortId } from './steps';

interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  record: StoredPasskeyRecord | null;
  result: AssertionVerificationResult | null;
  /** Raw bytes of the real sign-in behind `result`, for the base64url view. */
  bundle: RawAssertionBundle | null;
}

function groupHex(hex: string): string {
  return hex.match(/.{1,8}/g)?.join(' ') ?? '';
}

function JsonView({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  return (
    <>
      {'{\n'}
      {entries.map(([k, v], i) => (
        <span key={k}>
          {'  '}
          <span style={{ color: 'var(--ink)' }}>"{k}"</span>:{' '}
          <span style={{ color: 'var(--json-value)' }}>{JSON.stringify(v)}</span>
          {i < entries.length - 1 ? ',\n' : '\n'}
        </span>
      ))}
      {'}'}
    </>
  );
}

/** The key as the website uses it; WebCrypto's export-only `ext` flag is left out. */
function displayJwk({ ext: _ext, ...jwk }: JsonWebKey): Record<string, unknown> {
  return { ...jwk };
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={copy}
      className="inline-flex items-center"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        height: 30,
        padding: '0 10px',
        gap: 6,
        border: '1px solid rgba(43,36,32,.18)',
        borderRadius: 6,
        background: 'var(--surface)',
        color: copied ? 'var(--ok)' : 'var(--ink)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      {copied && <CheckIcon size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Block({ title, note, copy, children }: { title: string; note: string; copy?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex justify-between items-center" style={{ gap: 12 }}>
        <h3 className="kl-display" style={{ margin: 0, fontSize: 18, letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}>{note}</span>
      </div>
      <div
        style={{
          position: 'relative',
          background: 'rgba(43,36,32,.04)',
          border: '1px solid rgba(43,36,32,.10)',
          borderRadius: 8,
        }}
      >
        {copy !== undefined && <CopyButton label={title} text={copy} />}
        {children}
      </div>
    </section>
  );
}

const pre = {
  margin: 0,
  padding: '16px 18px',
  paddingRight: 80,
  fontFamily: 'var(--font-mono)',
  fontSize: 12.5,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-all' as const,
  color: 'rgba(43,36,32,.72)',
};

const FLAG_BITS: { bit: number; name: string }[] = [
  { bit: 7, name: 'ED' },
  { bit: 6, name: 'AT' },
  { bit: 5, name: '–' },
  { bit: 4, name: 'BS' },
  { bit: 3, name: 'BE' },
  { bit: 2, name: 'UV' },
  { bit: 1, name: '–' },
  { bit: 0, name: 'UP' },
];

function flagSummary(auth: ParsedAuthenticatorData): string {
  const f = auth.flags;
  const presence = f.UP ? (f.UV ? 'User present, user verified.' : 'User present, not verified.') : 'User not present.';
  const backup = f.BE
    ? f.BS
      ? 'Synced passkey, backed up.'
      : 'Can be synced, not backed up yet.'
    : 'Not backed up or synced.';
  return `${presence} ${backup}`;
}

function AuthDataView({ auth, rpId }: { auth: ParsedAuthenticatorData; rpId: string }) {
  const raw = auth.flags.rawByte;
  return (
    <div className="flex flex-col" style={{ padding: '16px 18px', gap: 16 }}>
      <div className="flex flex-col" style={{ gap: 4 }}>
        <span className="kl-micro">rpIdHash · bytes 0–31</span>
        <code style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: '42ch' }}>{groupHex(auth.rpIdHashHex)}</code>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>should be SHA-256("{rpId}")</span>
      </div>
      <div className="flex flex-col" style={{ gap: 8 }}>
        <span className="kl-micro">flags · byte 32 · 0x{raw.toString(16).padStart(2, '0')}</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gap: 4,
            textAlign: 'center',
            fontSize: 12,
          }}
        >
          {FLAG_BITS.map(({ bit, name }) => {
            const on = (raw >> bit) & 1;
            const reserved = name === '–';
            return (
              <div
                key={bit}
                title={`bit ${bit}`}
                style={{
                  borderRadius: 4,
                  padding: '6px 0',
                  border: on ? '2px solid var(--hard)' : `1px ${reserved ? 'dashed' : 'solid'} rgba(43,36,32,.14)`,
                  background: on ? 'var(--lime)' : reserved ? 'transparent' : 'var(--surface)',
                  boxShadow: on ? '3px 3px 0 var(--hard)' : undefined,
                  fontWeight: on ? 600 : 400,
                }}
              >
                <div>{on}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{name}</div>
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: 'rgba(43,36,32,.72)' }}>{flagSummary(auth)}</span>
      </div>
      <div className="flex flex-col" style={{ gap: 4 }}>
        <span className="kl-micro">signCount · bytes 33–36</span>
        <code style={{ fontSize: 12.5 }}>
          {auth.signCount.toString(16).padStart(8, '0')} = {auth.signCount}
        </code>
      </div>
    </div>
  );
}

function SignatureView({ sigHex, coseAlg }: { sigHex: string; coseAlg: number }) {
  if (coseAlg === -7) {
    try {
      const p1363 = derToP1363(hexToBytes(sigHex), 32);
      const hex = bytesToHex(p1363);
      return (
        <div className="flex flex-col" style={{ padding: '16px 18px', gap: 12 }}>
          {[
            ['r', hex.slice(0, 64)],
            ['s', hex.slice(64)],
          ].map(([name, part]) => (
            <div key={name} className="flex flex-col" style={{ gap: 4 }}>
              <span className="kl-micro">{name} · 32 bytes</span>
              <code style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: '42ch' }}>{groupHex(part)}</code>
            </div>
          ))}
          <span style={{ fontSize: 12, color: 'rgba(43,36,32,.72)' }}>
            Signed over authenticatorData ‖ SHA-256(clientDataJSON).
          </span>
        </div>
      );
    } catch {
      // Not valid DER: fall through and show the raw bytes
    }
  }
  return <pre style={pre}>{groupHex(sigHex)}</pre>;
}

/** Decoded bytes from the last ceremony. A modal dialog on the right. */
export function InspectorDrawer({ open, onClose, record, result, bundle }: InspectorDrawerProps) {
  const [view, setView] = useState<'decoded' | 'raw'>('decoded');
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const clientData: Record<string, unknown> | null =
    result?.clientData ?? (record ? JSON.parse(record.rawClientDataJson) : null);
  const auth: ParsedAuthenticatorData | null =
    result?.parsedAuthData ?? (record ? parseAuthenticatorData(hexToBytes(record.rawAuthenticatorDataHex)) : null);
  const tampered = result?.tamperMode && result.tamperMode !== 'none';
  const subject = result
    ? tampered
      ? `attack: ${result.tamperMode}`
      : 'last sign-in'
    : record
      ? 'registration'
      : 'nothing yet';

  const raw: { label: string; value: string }[] = [];
  if (bundle && result && !tampered) {
    raw.push({ label: 'clientDataJSON', value: bytesToBase64Url(bundle.clientDataBytes) });
    raw.push({ label: 'authenticatorData', value: bytesToBase64Url(bundle.authenticatorDataBytes) });
    raw.push({ label: 'signature', value: bytesToBase64Url(bundle.signatureBytes) });
  } else if (record && !result) {
    raw.push({ label: 'clientDataJSON', value: bytesToBase64Url(new TextEncoder().encode(record.rawClientDataJson)) });
    raw.push({ label: 'attestationObject', value: bytesToBase64Url(hexToBytes(record.rawAttestationObjectHex)) });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(43,36,32,.28)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
        className="flex flex-col"
        style={{
          width: 'min(560px, 100%)',
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--surface)',
          borderLeft: '1px solid rgba(43,36,32,.14)',
          boxShadow: '0 0 0 1px rgba(43,36,32,.08), 0 12px 32px rgba(43,36,32,.10)',
        }}
      >
        <div
          className="flex flex-col"
          style={{ padding: '24px 28px 0', gap: 16, borderBottom: '1px solid rgba(43,36,32,.14)' }}
        >
          <div className="flex justify-between items-start" style={{ gap: 12 }}>
            <div className="flex flex-col" style={{ gap: 4 }}>
              <span className="kl-micro">Inspector · {subject}</span>
              <h2
                id="inspector-title"
                className="kl-display"
                style={{ margin: 0, fontSize: 26, letterSpacing: '-0.03em' }}
              >
                {result ? 'What was signed' : 'What was created'}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close inspector"
              onClick={onClose}
              className="inline-flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                border: '1px solid rgba(43,36,32,.18)',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div role="group" aria-label="View" className="flex" style={{ gap: 24 }}>
            {(['decoded', 'raw'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                style={{
                  padding: '8px 0 10px',
                  border: 0,
                  borderBottom: `2px solid ${view === v ? 'var(--ink)' : 'transparent'}`,
                  background: 'none',
                  color: view === v ? 'var(--ink)' : 'var(--ink-3)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {v === 'decoded' ? 'Decoded' : 'Raw base64url'}
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex flex-col"
          style={{ flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', padding: '24px 28px', gap: 28 }}
        >
          {!record && !result && (
            <div
              style={{
                border: '1px dashed rgba(43,36,32,.18)',
                borderRadius: 8,
                padding: 18,
                fontSize: 13,
                color: 'var(--ink-3)',
              }}
            >
              Nothing captured yet. Create a passkey or sign in on the Play tab, then the real bytes show up here.
            </div>
          )}

          {view === 'decoded' && (
            <>
              {clientData && (
                <Block title="clientDataJSON" note="written by the browser" copy={JSON.stringify(clientData, null, 2)}>
                  <pre style={pre}>
                    <JsonView value={clientData} />
                  </pre>
                </Block>
              )}
              {auth && (
                <Block
                  title="authenticatorData"
                  note={`${auth.byteLength} bytes · from your device`}
                  copy={auth.rawHex}
                >
                  <AuthDataView auth={auth} rpId={record?.rpId ?? window.location.hostname} />
                </Block>
              )}
              {record && (
                <Block
                  title="Public key"
                  note="COSE → JWK · stored by the website"
                  copy={JSON.stringify(displayJwk(record.publicKeyJwk), null, 2)}
                >
                  <pre style={pre}>
                    <JsonView value={displayJwk(record.publicKeyJwk)} />
                  </pre>
                </Block>
              )}
              {result && record && (
                <Block
                  title="Signature"
                  note={`${record.algorithmName} · DER · ${result.signatureHex.length / 2} bytes`}
                  copy={result.signatureHex}
                >
                  <SignatureView sigHex={result.signatureHex} coseAlg={record.coseAlg} />
                </Block>
              )}
              {record && (
                <section
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr',
                    gap: '6px 12px',
                    fontSize: 13,
                    borderTop: '1px solid rgba(43,36,32,.10)',
                    paddingTop: 20,
                  }}
                >
                  <span style={{ color: 'var(--ink-3)' }}>Credential id</span>
                  <code style={{ overflowWrap: 'anywhere' }}>{shortId(record.id)}</code>
                  <span style={{ color: 'var(--ink-3)' }}>User handle</span>
                  <code>{shortId(record.userHandleHex, 8, 4)}</code>
                  <span style={{ color: 'var(--ink-3)' }}>Authenticator</span>
                  <span>{record.aaguidName}</span>
                  <span style={{ color: 'var(--ink-3)' }}>AAGUID</span>
                  <code style={{ overflowWrap: 'anywhere' }}>{record.aaguid}</code>
                </section>
              )}
            </>
          )}

          {view === 'raw' && (
            <>
              {raw.map((r) => (
                <Block key={r.label} title={r.label} note={`${r.value.length} characters`} copy={r.value}>
                  <pre style={pre}>{r.value}</pre>
                </Block>
              ))}
              {tampered && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)' }}>
                  Attacks edit a copy in memory, so there are no raw bytes to show for them. The decoded view shows what
                  the website was given.
                </p>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(43,36,32,.14)',
            fontSize: 12,
            color: 'var(--ink-3)',
          }}
        >
          From your last {result ? 'sign-in' : 'registration'}. Nothing here is sent anywhere.
        </div>
      </aside>
    </div>
  );
}
