import type { EnvironmentCapabilities } from '../hooks/useEnvironment';

/** A lime band that only appears when this browser is missing something keylime needs. */
export function CapabilityStrip({ env }: { env: EnvironmentCapabilities }) {
  const missing = [
    { label: 'passkeys (WebAuthn)', ok: env.webAuthnSupported },
    { label: env.platformName, ok: env.platformAuthenticatorAvailable },
    { label: 'a secure (https) page', ok: env.secureContext },
    { label: 'a top-level page', ok: !env.isIframe },
  ].filter((c) => c.ok === false);

  if (missing.length === 0) return null;

  return (
    <div role="status" style={{ background: 'var(--lime)', borderBottom: '1px solid var(--line)' }}>
      <p className="kl-wrap" style={{ margin: 0, padding: '10px 32px', fontSize: 14 }}>
        This browser is missing {missing.map((m) => m.label).join(', ')}. Some steps won't work here.
      </p>
    </div>
  );
}
