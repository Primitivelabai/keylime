import { useEffect, useState } from 'react';

export interface EnvironmentCapabilities {
  webAuthnSupported: boolean;
  platformAuthenticatorAvailable: boolean | null;
  conditionalMediationAvailable: boolean | null;
  isIframe: boolean;
  iframePolicyBlocked: boolean;
  rpId: string;
  origin: string;
  secureContext: boolean;
  /** Friendly name for this device's built-in authenticator, guessed from the user agent. */
  platformName: string;
}

function guessPlatformName(): string {
  if (typeof navigator === 'undefined') return 'Platform authenticator';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows Hello';
  if (/iPhone|iPad/i.test(ua)) return 'Face ID or Touch ID';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Touch ID';
  if (/Android/i.test(ua)) return 'Screen lock';
  return 'Platform authenticator';
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/** Feature-detects WebAuthn, the platform authenticator, autofill and iframe embedding. */
export function useEnvironment() {
  const [env, setEnv] = useState<EnvironmentCapabilities>({
    webAuthnSupported: true,
    platformAuthenticatorAvailable: null,
    conditionalMediationAvailable: null,
    isIframe: false,
    iframePolicyBlocked: false,
    rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
    secureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
    platformName: guessPlatformName(),
  });

  useEffect(() => {
    let mounted = true;

    async function detect() {
      const supported =
        typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        typeof navigator.credentials !== 'undefined';

      let isIframe = false;
      try {
        isIframe = window.self !== window.top;
      } catch {
        isIframe = true;
      }

      // Check Permissions Policy if the browser exposes it
      let iframePolicyBlocked = false;
      const docAny = document as unknown as {
        permissionsPolicy?: { allowsFeature: (f: string) => boolean };
        featurePolicy?: { allowsFeature: (f: string) => boolean };
      };
      const policy = docAny.permissionsPolicy || docAny.featurePolicy;
      if (policy && typeof policy.allowsFeature === 'function') {
        try {
          const canCreate = policy.allowsFeature('publickey-credentials-create');
          const canGet = policy.allowsFeature('publickey-credentials-get');
          if (!canCreate || !canGet) iframePolicyBlocked = true;
        } catch {
          // Feature name not recognised by this engine
        }
      }

      let platformAvail: boolean | null = null;
      let conditionalAvail: boolean | null = null;

      if (supported) {
        try {
          if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            platformAvail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          }
          if (typeof PublicKeyCredential.isConditionalMediationAvailable === 'function') {
            conditionalAvail = await PublicKeyCredential.isConditionalMediationAvailable();
          }
        } catch {
          // Some sandboxed iframes throw SecurityError even on feature checks
          if (isIframe) iframePolicyBlocked = true;
        }
      }

      if (!mounted) return;
      setEnv((prev) => ({
        ...prev,
        webAuthnSupported: supported,
        platformAuthenticatorAvailable: platformAvail,
        conditionalMediationAvailable: conditionalAvail,
        isIframe,
        iframePolicyBlocked,
        rpId: window.location.hostname || 'localhost',
        origin: window.location.origin,
        secureContext: window.isSecureContext,
      }));
    }

    detect();
    return () => {
      mounted = false;
    };
  }, []);

  return [env, setEnv] as const;
}
