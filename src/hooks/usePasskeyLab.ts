import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bytes } from '../lib/encoding';
import { base64UrlToBytes, bytesToBase64Url } from '../lib/encoding';
import {
  type AssertionVerificationResult,
  type RawAssertionBundle,
  type StoredPasskeyRecord,
  type TamperMode,
  clearCredentialsInIndexedDB,
  generateRandomChallenge,
  getAllCredentialsFromIndexedDB,
  rpVerifyAndStoreRegistration,
  rpVerifyAssertion,
} from '../lib/rp';
import type { EnvironmentCapabilities } from './useEnvironment';

export type Phase = 'register' | 'signin';
export type AttackMode = Exclude<TamperMode, 'none'>;

/** How long the browser prompt may wait, in milliseconds. */
export const CEREMONY_TIMEOUT_MS = 60_000;

export interface CeremonyError {
  kind: 'blocked' | 'cancelled' | 'other';
  phase: Phase;
  message: string;
}

/** Values from the last ceremony, shown as chips in the step-by-step table. */
export interface CeremonyTrace {
  phase: Phase;
  challengeB64: string;
  rpId: string;
  userHandleB64?: string;
  credentialId?: string;
}

const DEFAULT_USERNAME = 'pol';

/**
 * All passkey state for the app: the real create/get ceremonies, the in-page
 * relying party, the tamper experiments and the IndexedDB reset.
 */
export function usePasskeyLab(
  env: EnvironmentCapabilities,
  setEnv: React.Dispatch<React.SetStateAction<EnvironmentCapabilities>>,
  reducedMotion: boolean
) {
  const [username, setUsername] = useState<string>(DEFAULT_USERNAME);
  const [storedRecord, setStoredRecord] = useState<StoredPasskeyRecord | null>(null);
  const [busyPhase, setBusyPhase] = useState<Phase | null>(null);
  const [ceremonyError, setCeremonyError] = useState<CeremonyError | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);

  const [flowPhase, setFlowPhase] = useState<Phase>('register');
  const [highlightedStepIdx, setHighlightedStepIdx] = useState<number>(-1);
  const [trace, setTrace] = useState<CeremonyTrace | null>(null);

  const [lastAssertionBundle, setLastAssertionBundle] = useState<RawAssertionBundle | null>(null);
  const [lastAssertionChallenge, setLastAssertionChallenge] = useState<Bytes | null>(null);
  const [lastAssertionResult, setLastAssertionResult] = useState<AssertionVerificationResult | null>(null);

  const [attackResults, setAttackResults] = useState<Partial<Record<AttackMode, AssertionVerificationResult>>>({});
  const [attackRunning, setAttackRunning] = useState<AttackMode | null>(null);

  const [resetNotice, setResetNotice] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);

  // Restore an existing public key from IndexedDB
  useEffect(() => {
    let mounted = true;
    getAllCredentialsFromIndexedDB()
      .then((records) => {
        if (!mounted || records.length === 0) return;
        const latest = records[records.length - 1];
        setStoredRecord(latest);
        setUsername(latest.username);
        setFlowPhase('signin');
      })
      .catch(() => {
        // IndexedDB unavailable in restricted mode
      });
    return () => {
      mounted = false;
    };
  }, []);

  /** Moves the highlight through the steps; skips the pause under reduced motion. */
  const showStep = async (phase: Phase, idx: number) => {
    setFlowPhase(phase);
    setHighlightedStepIdx(idx);
    if (!reducedMotion) await new Promise((r) => setTimeout(r, 420));
  };

  const classifyError = (err: unknown, phase: Phase): CeremonyError => {
    const msg = err instanceof Error ? err.message : String(err);
    const feature = phase === 'register' ? 'publickey-credentials-create' : 'publickey-credentials-get';
    if (
      msg.toLowerCase().includes('permissions policy') ||
      msg.toLowerCase().includes(feature) ||
      (env.isIframe && err instanceof DOMException && err.name === 'NotAllowedError')
    ) {
      setEnv((prev) => ({ ...prev, iframePolicyBlocked: true }));
      return { kind: 'blocked', phase, message: msg };
    }
    if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
      return { kind: 'cancelled', phase, message: msg };
    }
    return { kind: 'other', phase, message: msg };
  };

  const startPrompt = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDeadline(Date.now() + CEREMONY_TIMEOUT_MS);
    return controller.signal;
  };

  const endPrompt = () => {
    abortRef.current = null;
    setDeadline(null);
    setBusyPhase(null);
  };

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Real passkey registration: navigator.credentials.create()
  const register = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUsername = username.trim() || DEFAULT_USERNAME;
    setCeremonyError(null);
    setResetNotice(false);
    setLastAssertionResult(null);
    setBusyPhase('register');

    try {
      // Step 1: the website makes a 32-byte challenge and an anonymous 16-byte user handle
      const challenge = generateRandomChallenge(32);
      const userHandle = generateRandomChallenge(16);
      const rpId = window.location.hostname;

      if (!rpId) {
        throw new Error(
          'This page has no hostname (likely an about:srcdoc frame), so WebAuthn cannot run. Open it in its own tab.'
        );
      }

      setTrace({
        phase: 'register',
        challengeB64: bytesToBase64Url(challenge),
        rpId,
        userHandleB64: bytesToBase64Url(userHandle),
      });
      await showStep('register', 0);
      await showStep('register', 1);

      const signal = startPrompt();
      // Steps 2 and 3: the real browser registration ceremony
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'keylime', id: rpId },
          user: { id: userHandle, name: cleanUsername, displayName: cleanUsername },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256 (ECDSA P-256)
            { type: 'public-key', alg: -257 }, // RS256 (RSASSA-PKCS1-v1_5)
          ],
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
          timeout: CEREMONY_TIMEOUT_MS,
          attestation: 'none',
        },
        signal,
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error('The authenticator returned no credential.');

      setTrace((t) => (t ? { ...t, credentialId: credential.id } : t));
      await showStep('register', 2);

      // Step 4: the in-page website decodes the attestation and stores the public key
      const record = await rpVerifyAndStoreRegistration({
        credential,
        expectedChallenge: challenge,
        expectedOrigin: window.location.origin,
        expectedRpId: rpId,
        username: cleanUsername,
        userHandle,
      });

      await showStep('register', 3);
      setStoredRecord(record);
      setLastAssertionBundle(null);
      setLastAssertionChallenge(null);
      setAttackResults({});
    } catch (err) {
      setCeremonyError(classifyError(err, 'register'));
    } finally {
      endPrompt();
    }
  };

  // Real passkey sign-in: navigator.credentials.get()
  const signIn = async () => {
    if (!storedRecord) return;
    setCeremonyError(null);
    setResetNotice(false);
    setBusyPhase('signin');

    try {
      // Step 1: a fresh 32-byte challenge
      const challenge = generateRandomChallenge(32);
      const rpId = window.location.hostname;

      setTrace({ phase: 'signin', challengeB64: bytesToBase64Url(challenge), rpId, credentialId: storedRecord.id });
      await showStep('signin', 0);
      await showStep('signin', 1);

      const signal = startPrompt();
      // Steps 2 and 3: the real browser assertion ceremony
      const assertionCred = (await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId,
          allowCredentials: [{ type: 'public-key', id: base64UrlToBytes(storedRecord.id) }],
          userVerification: 'preferred',
          timeout: CEREMONY_TIMEOUT_MS,
        },
        signal,
      })) as PublicKeyCredential | null;

      if (!assertionCred) throw new Error('The authenticator returned no assertion.');

      await showStep('signin', 2);

      const authResponse = assertionCred.response as AuthenticatorAssertionResponse;
      const bundle: RawAssertionBundle = {
        credentialId: assertionCred.id,
        clientDataBytes: new Uint8Array(authResponse.clientDataJSON),
        authenticatorDataBytes: new Uint8Array(authResponse.authenticatorData),
        signatureBytes: new Uint8Array(authResponse.signature),
      };

      // Step 4: the website checks every field and the signature with WebCrypto
      const verification = await rpVerifyAssertion({
        assertion: bundle,
        storedRecord,
        expectedChallenge: challenge,
        expectedOrigin: window.location.origin,
        expectedRpId: rpId,
        tamperMode: 'none',
      });

      await showStep('signin', 3);
      setLastAssertionBundle(bundle);
      setLastAssertionChallenge(challenge);
      setLastAssertionResult(verification);
      setAttackResults({});

      // Pick up a new signCount if the website stored one
      const updated = await getAllCredentialsFromIndexedDB();
      const fresh = updated.find((r) => r.id === storedRecord.id);
      if (fresh) setStoredRecord(fresh);
    } catch (err) {
      setCeremonyError(classifyError(err, 'signin'));
    } finally {
      endPrompt();
    }
  };

  /** Re-verifies the last real sign-in with one part changed. Never touches the passkey itself. */
  const runAttack = async (mode: AttackMode) => {
    if (!storedRecord || !lastAssertionBundle || !lastAssertionChallenge) return;
    setAttackRunning(mode);
    try {
      let overrideJwk: JsonWebKey | undefined;
      let challengeToVerify = lastAssertionChallenge;

      if (mode === 'wrong-public-key') {
        // A genuine, separate P-256 key pair: the signature must not verify against it
        const rogue = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        overrideJwk = await crypto.subtle.exportKey('jwk', rogue.publicKey);
      } else if (mode === 'replay-old-assertion') {
        // The website has moved on to a new challenge; the old response is sent again
        challengeToVerify = generateRandomChallenge(32);
      }

      const result = await rpVerifyAssertion({
        assertion: lastAssertionBundle,
        storedRecord,
        expectedChallenge: challengeToVerify,
        expectedOrigin: window.location.origin,
        expectedRpId: window.location.hostname,
        tamperMode: mode,
        overrideJwk,
      });
      setAttackResults((prev) => ({ ...prev, [mode]: result }));
    } finally {
      setAttackRunning(null);
    }
  };

  // Deletes the stored public key from the website's IndexedDB
  const reset = async () => {
    await clearCredentialsInIndexedDB();
    setStoredRecord(null);
    setLastAssertionBundle(null);
    setLastAssertionChallenge(null);
    setLastAssertionResult(null);
    setAttackResults({});
    setTrace(null);
    setFlowPhase('register');
    setHighlightedStepIdx(-1);
    setCeremonyError(null);
    setResetNotice(true);
  };

  return {
    username,
    setUsername,
    storedRecord,
    busyPhase,
    ceremonyError,
    dismissError: () => setCeremonyError(null),
    deadline,
    flowPhase,
    setFlowPhase,
    highlightedStepIdx,
    setHighlightedStepIdx,
    trace,
    lastAssertionBundle,
    lastAssertionResult,
    attackResults,
    attackRunning,
    resetNotice,
    dismissResetNotice: () => setResetNotice(false),
    register,
    signIn,
    cancel,
    runAttack,
    reset,
  };
}

export type PasskeyLab = ReturnType<typeof usePasskeyLab>;
