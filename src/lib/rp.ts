import type { Bytes } from './encoding';
import { bytesToBase64Url, bytesToHex, bytesEqual, concatBytes } from './encoding';
import { decodeCBOR } from './cbor';
import { parseAuthenticatorData, derToP1363, type AuthenticatorFlags, type ParsedAuthenticatorData } from './webauthn';

export interface StoredPasskeyRecord {
  id: string; // Base64URL Credential ID
  username: string;
  userHandleHex: string;
  rpId: string;
  publicKeyJwk: JsonWebKey;
  coseAlg: number;
  algorithmName: string;
  aaguid: string;
  aaguidName: string;
  signCount: number;
  flags: AuthenticatorFlags;
  createdAt: string;
  attestationFormat: string;
  rawClientDataJson: string;
  rawAuthenticatorDataHex: string;
  rawAttestationObjectHex: string;
}

export interface VerificationCheckItem {
  id: string;
  label: string;
  passed: boolean;
  expected: string;
  actual: string;
  explanation: string;
}

export interface AssertionVerificationResult {
  valid: boolean;
  headline: string;
  failureReason?: string;
  checks: VerificationCheckItem[];
  clientData: Record<string, unknown>;
  parsedAuthData: ParsedAuthenticatorData;
  signatureHex: string;
  signedPayloadHex: string;
  tamperMode?: TamperMode;
}

const DB_NAME = 'passkey-playground-rp-db';
const STORE_NAME = 'credentials';

function openRPDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser context.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

async function saveCredentialToIndexedDB(record: StoredPasskeyRecord): Promise<void> {
  const db = await openRPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to save credential to IndexedDB.'));
    };
  });
}

export async function getAllCredentialsFromIndexedDB(): Promise<StoredPasskeyRecord[]> {
  const db = await openRPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredPasskeyRecord[]) || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Failed to read credentials from IndexedDB.'));
    };
  });
}

export async function clearCredentialsInIndexedDB(): Promise<void> {
  const db = await openRPDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to clear IndexedDB.'));
    };
  });
}

/**
 * Generates a cryptographically strong random challenge using WebCrypto.
 */
export function generateRandomChallenge(byteLength = 32): Bytes {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return buf;
}

/**
 * Relying Party server-side processing of `navigator.credentials.create()` response.
 * Decodes CBOR `attestationObject`, validates `clientDataJSON` and `rpIdHash`,
 * extracts the COSE public key as JWK, and stores it in IndexedDB.
 */
export async function rpVerifyAndStoreRegistration(params: {
  credential: PublicKeyCredential;
  expectedChallenge: Bytes;
  expectedOrigin: string;
  expectedRpId: string;
  username: string;
  userHandle: Bytes;
}): Promise<StoredPasskeyRecord> {
  const { credential, expectedChallenge, expectedOrigin, expectedRpId, username, userHandle } = params;
  const response = credential.response as AuthenticatorAttestationResponse;

  const clientDataBytes = new Uint8Array(response.clientDataJSON);
  const clientDataText = new TextDecoder().decode(clientDataBytes);
  const clientData = JSON.parse(clientDataText) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };

  if (clientData.type !== 'webauthn.create') {
    throw new Error(`Invalid clientData.type: expected "webauthn.create", got "${clientData.type}"`);
  }

  const expectedChallengeB64 = bytesToBase64Url(expectedChallenge);
  if (clientData.challenge !== expectedChallengeB64) {
    throw new Error('Registration challenge mismatch: clientDataJSON.challenge does not match server challenge.');
  }

  if (clientData.origin !== expectedOrigin) {
    throw new Error(`Origin mismatch: expected "${expectedOrigin}", got "${clientData.origin}".`);
  }

  const attestationBytes = new Uint8Array(response.attestationObject);
  const decodedAttestation = decodeCBOR(attestationBytes);
  if (!(decodedAttestation instanceof Map)) {
    throw new Error('attestationObject did not decode to a CBOR map.');
  }

  const fmt = String(decodedAttestation.get('fmt') ?? 'none');
  const authDataRaw = decodedAttestation.get('authData');
  if (!(authDataRaw instanceof Uint8Array)) {
    throw new Error('attestationObject is missing binary authData.');
  }

  const parsedAuth = parseAuthenticatorData(authDataRaw);

  // Verify SHA-256(rpId) === authData.rpIdHash
  const expectedRpIdHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId));
  const expectedRpIdHash = new Uint8Array(expectedRpIdHashBuf);
  if (!bytesEqual(parsedAuth.rpIdHashBytes, expectedRpIdHash)) {
    throw new Error(
      `RP ID hash mismatch: authenticator signed for ${parsedAuth.rpIdHashHex.slice(0, 16)}…, expected ${bytesToHex(expectedRpIdHash).slice(0, 16)}…`
    );
  }

  if (!parsedAuth.flags.UP) {
    throw new Error('User Present (UP) flag was false during registration.');
  }

  if (!parsedAuth.attestedCredentialData) {
    throw new Error('Authenticator did not return attestedCredentialData (AT flag not set).');
  }

  // Validate that WebCrypto can genuinely import the extracted JWK public key
  const { publicKeyJwk, coseAlg, algorithmName, aaguid, aaguidName, credentialIdBase64Url } =
    parsedAuth.attestedCredentialData;

  if (coseAlg === -7) {
    await crypto.subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  } else if (coseAlg === -257) {
    await crypto.subtle.importKey('jwk', publicKeyJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, [
      'verify',
    ]);
  }

  const record: StoredPasskeyRecord = {
    id: credentialIdBase64Url,
    username,
    userHandleHex: bytesToHex(userHandle),
    rpId: expectedRpId,
    publicKeyJwk,
    coseAlg,
    algorithmName,
    aaguid,
    aaguidName,
    signCount: parsedAuth.signCount,
    flags: parsedAuth.flags,
    createdAt: new Date().toISOString(),
    attestationFormat: fmt,
    rawClientDataJson: clientDataText,
    rawAuthenticatorDataHex: parsedAuth.rawHex,
    rawAttestationObjectHex: bytesToHex(attestationBytes),
  };

  await saveCredentialToIndexedDB(record);
  return record;
}

export type TamperMode = 'none' | 'flip-challenge-byte' | 'swap-origin' | 'replay-old-assertion' | 'wrong-public-key';

export interface RawAssertionBundle {
  credentialId: string;
  clientDataBytes: Bytes;
  authenticatorDataBytes: Bytes;
  signatureBytes: Bytes;
}

/**
 * Relying Party server-side verification of `navigator.credentials.get()` assertion.
 * Runs real cryptographic checks using WebCrypto (`SHA-256`, `ECDSA P-256`, `RSASSA-PKCS1-v1_5`).
 * Also supports optional controlled tampering modes to demonstrate how each check protects users.
 */
export async function rpVerifyAssertion(params: {
  assertion: RawAssertionBundle;
  storedRecord: StoredPasskeyRecord;
  expectedChallenge: Bytes;
  expectedOrigin: string;
  expectedRpId: string;
  tamperMode?: TamperMode;
  overrideJwk?: JsonWebKey;
}): Promise<AssertionVerificationResult> {
  const {
    assertion,
    storedRecord,
    expectedChallenge,
    expectedOrigin,
    expectedRpId,
    tamperMode = 'none',
    overrideJwk,
  } = params;

  const checks: VerificationCheckItem[] = [];
  let clientDataBytes = new Uint8Array(assertion.clientDataBytes);
  const authDataBytes = new Uint8Array(assertion.authenticatorDataBytes);
  const signatureBytes = new Uint8Array(assertion.signatureBytes);

  // Tamper modes edit a copy of the response before any check runs
  if (tamperMode === 'swap-origin') {
    const parsed = JSON.parse(new TextDecoder().decode(clientDataBytes));
    parsed.origin = 'https://evil-login-phish.example';
    clientDataBytes = new TextEncoder().encode(JSON.stringify(parsed));
  }

  let clientData: Record<string, unknown> = {};
  try {
    clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
  } catch {
    return {
      valid: false,
      headline: 'Malformed clientDataJSON',
      failureReason: 'clientDataJSON could not be parsed as valid UTF-8 JSON.',
      checks: [],
      clientData: {},
      parsedAuthData: parseAuthenticatorData(authDataBytes),
      signatureHex: bytesToHex(signatureBytes),
      signedPayloadHex: '',
      tamperMode,
    };
  }

  // Check 1: Ceremony Type
  const typeValid = clientData.type === 'webauthn.get';
  checks.push({
    id: 'type',
    label: 'Type is webauthn.get',
    passed: typeValid,
    expected: 'webauthn.get',
    actual: String(clientData.type ?? 'missing'),
    explanation: 'Prevents a registration response from ever being replayed as a sign-in assertion.',
  });

  // Check 2: Challenge Match
  let effectiveExpectedChallenge = new Uint8Array(expectedChallenge);
  if (tamperMode === 'flip-challenge-byte') {
    effectiveExpectedChallenge[0] ^= 0xff; // Flip all 8 bits of byte 0
  }
  const expectedChallengeB64 = bytesToBase64Url(effectiveExpectedChallenge);
  const actualChallengeB64 = String(clientData.challenge ?? '');
  const challengeValid = actualChallengeB64 === expectedChallengeB64;
  checks.push({
    id: 'challenge',
    label: 'Challenge is the one we issued',
    passed: challengeValid,
    expected: `${expectedChallengeB64.slice(0, 18)}…`,
    actual: `${actualChallengeB64.slice(0, 18)}…`,
    explanation: 'Guarantees freshness: an old captured signature cannot be replayed against a new login challenge.',
  });

  // Check 3: Origin Binding
  const actualOrigin = String(clientData.origin ?? '');
  const originValid = actualOrigin === expectedOrigin;
  checks.push({
    id: 'origin',
    label: 'Origin matches',
    passed: originValid,
    expected: expectedOrigin,
    actual: actualOrigin,
    explanation:
      'Binds the signature to the exact HTTPS origin. A phishing domain produces a different origin and fails.',
  });

  const parsedAuth = parseAuthenticatorData(authDataBytes);

  // Check 4: RP ID Hash (SHA-256 of domain)
  const expectedRpIdHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId));
  const expectedRpIdHash = new Uint8Array(expectedRpIdHashBuf);
  const rpIdHashValid = bytesEqual(parsedAuth.rpIdHashBytes, expectedRpIdHash);
  checks.push({
    id: 'rpIdHash',
    label: 'Domain hash matches',
    passed: rpIdHashValid,
    expected: `${bytesToHex(expectedRpIdHash).slice(0, 16)}… (${expectedRpId})`,
    actual: `${parsedAuth.rpIdHashHex.slice(0, 16)}…`,
    explanation: 'The authenticator hashes the domain it actually talked to. Phishing sites cannot forge this hash.',
  });

  // Check 5: User Present (UP) Flag
  checks.push({
    id: 'upFlag',
    label: 'User was present',
    passed: parsedAuth.flags.UP,
    expected: 'UP = 1 (true)',
    actual: `UP = ${parsedAuth.flags.UP ? '1 (true)' : '0 (false)'} · UV = ${parsedAuth.flags.UV ? '1' : '0'}`,
    explanation: 'Confirms a human physically interacted with the authenticator (touch, Face ID, Touch ID, or PIN).',
  });

  // Check 6: Sign Counter (Clone / Replay Detection)
  // Per WebAuthn §7.2 step 17: if both stored and reported signCount are > 0, new must be > stored.
  // Synced passkeys (iCloud Keychain, Google Password Manager) legitimately keep signCount === 0.
  const counterValid =
    parsedAuth.signCount === 0 && storedRecord.signCount === 0 ? true : parsedAuth.signCount > storedRecord.signCount;
  checks.push({
    id: 'signCount',
    label: 'Sign count is sane',
    passed: counterValid,
    expected: storedRecord.signCount === 0 ? '0 (synced passkey) or > 0' : `> ${storedRecord.signCount}`,
    actual: `${parsedAuth.signCount}${parsedAuth.signCount === 0 ? ' (synced passkey mode)' : ''}`,
    explanation: 'Detects cloned hardware authenticators if a counter stops advancing or moves backward.',
  });

  // Check 7: Real WebCrypto Asymmetric Signature Verification
  // Signed data per WebAuthn spec = authenticatorData || SHA-256(clientDataJSON)
  const clientDataHashBuf = await crypto.subtle.digest('SHA-256', clientDataBytes);
  const clientDataHash = new Uint8Array(clientDataHashBuf);
  const signedPayload = concatBytes(authDataBytes, clientDataHash);

  const jwkToUse = overrideJwk || storedRecord.publicKeyJwk;
  let cryptoSigValid = false;
  let cryptoDetail = '';

  try {
    if (storedRecord.coseAlg === -7 && jwkToUse.kty === 'EC') {
      const publicKey = await crypto.subtle.importKey('jwk', jwkToUse, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'verify',
      ]);
      const p1363Sig = derToP1363(signatureBytes, 32);
      cryptoSigValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        p1363Sig,
        signedPayload
      );
      cryptoDetail = cryptoSigValid
        ? 'ECDSA P-256 signature mathematically verified against stored public key.'
        : 'ECDSA P-256 signature check returned FALSE (payload or public key mismatch).';
    } else if (storedRecord.coseAlg === -257 && jwkToUse.kty === 'RSA') {
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        jwkToUse,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      cryptoSigValid = await crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        publicKey,
        signatureBytes,
        signedPayload
      );
      cryptoDetail = cryptoSigValid
        ? 'RSA PKCS#1 v1.5 signature verified against stored public key.'
        : 'RSA signature check returned FALSE.';
    } else {
      cryptoDetail = `Algorithm/key mismatch: credential uses COSE ${storedRecord.coseAlg}, key type is ${jwkToUse.kty}.`;
    }
  } catch (err) {
    cryptoSigValid = false;
    cryptoDetail = err instanceof Error ? err.message : 'WebCrypto verification threw an error.';
  }

  checks.push({
    id: 'signature',
    label: 'Signature checks out',
    passed: cryptoSigValid,
    expected: overrideJwk ? 'Match stored credential public key' : `Valid ${storedRecord.algorithmName} signature`,
    actual: cryptoSigValid ? 'Verified (100% authentic)' : 'INVALID SIGNATURE',
    explanation: cryptoDetail,
  });

  const failedChecks = checks.filter((c) => !c.passed);
  const valid = failedChecks.length === 0;

  // Update stored signCount if valid and non-zero
  if (valid && tamperMode === 'none' && parsedAuth.signCount > storedRecord.signCount) {
    await saveCredentialToIndexedDB({
      ...storedRecord,
      signCount: parsedAuth.signCount,
      flags: parsedAuth.flags,
    });
  }

  return {
    valid,
    headline: valid ? 'Signed in' : `Sign-in rejected: ${failedChecks[0].label}`,
    failureReason: valid ? undefined : `${failedChecks[0].label}: ${failedChecks[0].explanation}`,
    checks,
    clientData,
    parsedAuthData: parsedAuth,
    signatureHex: bytesToHex(signatureBytes),
    signedPayloadHex: bytesToHex(signedPayload),
    tamperMode,
  };
}
