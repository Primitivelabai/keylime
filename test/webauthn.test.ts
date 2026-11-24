import { describe, it, expect } from 'vitest';
import { bytesToBase64Url, bytesToHex, concatBytes, hexToBytes } from '../src/lib/encoding';
import { decodeCBORItem } from '../src/lib/cbor';
import { parseAuthenticatorData, p1363ToDer, derToP1363 } from '../src/lib/webauthn';
import { rpVerifyAssertion, type StoredPasskeyRecord, type TamperMode } from '../src/lib/rp';
import { runWebAuthnSpecUnitTests } from '../src/lib/specTests';

const enc = new TextEncoder();
const sha256 = async (b: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.digest('SHA-256', b));

describe('encoding and CBOR', () => {
  it('SHA-256("example.com") matches the known digest', async () => {
    expect(bytesToHex(await sha256(enc.encode('example.com')))).toBe(
      'a379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce1947'
    );
  });

  it('decodes a COSE map with negative keys and exact length', () => {
    const bytes = hexToBytes('a5010203262001214401020304224405060708');
    const { value, nextOffset } = decodeCBORItem(bytes);
    expect(nextOffset).toBe(bytes.length);
    expect(value).toBeInstanceOf(Map);
    const m = value as Map<unknown, unknown>;
    expect(m.get(3)).toBe(-7);
    expect(bytesToHex(m.get(-3) as Uint8Array)).toBe('05060708');
  });

  it('rejects truncated CBOR', () => {
    expect(() => decodeCBORItem(hexToBytes('5820aabb'))).toThrow();
  });

  it('parses flags and big-endian signCount', () => {
    const p = parseAuthenticatorData(hexToBytes('00'.repeat(32) + '1d' + '0000002a'));
    expect(p.flags).toMatchObject({ UP: true, UV: true, BE: true, BS: true, AT: false });
    expect(p.signCount).toBe(42);
  });

  it('DER <-> P1363 round trip', () => {
    const raw = crypto.getRandomValues(new Uint8Array(64));
    raw[0] = 0x80; // force sign padding path
    raw[32] = 0x00; // force leading-zero trim path
    expect(bytesToHex(derToP1363(p1363ToDer(raw)))).toBe(bytesToHex(raw));
  });
});

describe('relying party verification (real ES256 signatures)', async () => {
  const origin = 'https://playground.example';
  const rpId = 'playground.example';
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const authData = concatBytes(await sha256(enc.encode(rpId)), new Uint8Array([0x05]), new Uint8Array(4));
  const clientDataBytes = enc.encode(
    JSON.stringify({ type: 'webauthn.get', challenge: bytesToBase64Url(challenge), origin })
  );
  const signed = concatBytes(authData, await sha256(clientDataBytes));
  const sig = p1363ToDer(
    new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, signed))
  );
  const record = {
    id: 'cred',
    publicKeyJwk: jwk,
    coseAlg: -7,
    algorithmName: 'ES256',
    signCount: 0,
  } as StoredPasskeyRecord;
  const verify = (tamperMode: TamperMode = 'none', extra: object = {}) =>
    rpVerifyAssertion({
      assertion: { credentialId: 'cred', clientDataBytes, authenticatorDataBytes: authData, signatureBytes: sig },
      storedRecord: record,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRpId: rpId,
      tamperMode,
      ...extra,
    });

  it('accepts the genuine assertion', async () => {
    const r = await verify();
    expect(r.checks.filter((c) => !c.passed)).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('rejects a phishing origin (and its signature)', async () => {
    const r = await verify('swap-origin');
    expect(r.valid).toBe(false);
    expect(r.checks.find((c) => c.id === 'origin')?.passed).toBe(false);
    expect(r.checks.find((c) => c.id === 'signature')?.passed).toBe(false);
  });

  it('rejects a flipped challenge', async () => {
    const r = await verify('flip-challenge-byte');
    expect(r.checks.find((c) => c.id === 'challenge')?.passed).toBe(false);
  });

  it('rejects a replay against a new challenge', async () => {
    const r = await verify('replay-old-assertion', { expectedChallenge: crypto.getRandomValues(new Uint8Array(32)) });
    expect(r.valid).toBe(false);
  });

  it('rejects a different public key', async () => {
    const rogue = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const r = await verify('wrong-public-key', { overrideJwk: await crypto.subtle.exportKey('jwk', rogue.publicKey) });
    expect(r.checks.find((c) => c.id === 'signature')?.passed).toBe(false);
  });

  it('rejects the wrong rpId', async () => {
    const r = await verify('none', { expectedRpId: 'evil.example' });
    expect(r.checks.find((c) => c.id === 'rpIdHash')?.passed).toBe(false);
  });
});

describe('in-page spec suite', () => {
  it('all browser self-tests pass in Node WebCrypto too', async () => {
    const results = await runWebAuthnSpecUnitTests();
    expect(results.filter((r) => !r.passed)).toEqual([]);
  });
});
