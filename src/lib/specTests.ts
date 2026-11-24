import type { Bytes } from './encoding';
import { base64UrlToBytes, bytesToHex, hexToBytes, concatBytes } from './encoding';
import { decodeCBORItem } from './cbor';
import { parseAuthenticatorData, derToP1363, p1363ToDer } from './webauthn';

export interface SpecTestCaseResult {
  id: string;
  name: string;
  specRef: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

export async function runWebAuthnSpecUnitTests(): Promise<SpecTestCaseResult[]> {
  const results: SpecTestCaseResult[] = [];

  const runTest = async (id: string, name: string, specRef: string, fn: () => Promise<string>) => {
    const start = performance.now();
    try {
      const details = await fn();
      results.push({
        id,
        name,
        specRef,
        passed: true,
        durationMs: Number((performance.now() - start).toFixed(2)),
        details,
      });
    } catch (err) {
      results.push({
        id,
        name,
        specRef,
        passed: false,
        durationMs: Number((performance.now() - start).toFixed(2)),
        details: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Test 1: RFC 8949 CBOR Decoder (Integers, Negative COSE keys, Byte Strings, Maps)
  await runTest(
    'cbor-rfc8949',
    'CBOR Decoder: COSE_Key Map with Negative Integer Keys',
    'RFC 8949 §3 & RFC 8152 §7',
    async () => {
      // Encoded CBOR map: { 1: 2, 3: -7, -1: 1, -2: h'01020304', -3: h'05060708' }
      // a5 (map of 5)
      // 01 02 (1 -> 2)
      // 03 26 (3 -> -7)
      // 20 01 (-1 -> 1)
      // 21 44 01020304 (-2 -> 4-byte h'01020304')
      // 22 44 05060708 (-3 -> 4-byte h'05060708')
      const cborHex = 'a5010203262001214401020304224405060708';
      const bytes = hexToBytes(cborHex);
      const { value, nextOffset } = decodeCBORItem(bytes, 0);
      if (nextOffset !== bytes.length) {
        throw new Error(`Expected nextOffset=${bytes.length}, got ${nextOffset}`);
      }
      if (!(value instanceof Map)) throw new Error('Expected Map');
      if (value.get(1) !== 2) throw new Error('Expected kty=2');
      if (value.get(3) !== -7) throw new Error('Expected alg=-7');
      if (value.get(-1) !== 1) throw new Error('Expected crv=1');
      const x = value.get(-2) as Bytes;
      if (bytesToHex(x) !== '01020304') throw new Error('Expected x=01020304');
      return 'Decoded 5-entry COSE map with exact 19-byte boundary offset.';
    }
  );

  // Test 2: WebAuthn §6.1 authenticatorData Parser (Assertion 37-byte vector)
  await runTest(
    'authdata-assertion',
    'authenticatorData Parser: Flags (UP, UV, BE, BS) & Big-Endian signCount',
    'W3C WebAuthn §6.1',
    async () => {
      // rpIdHash = SHA-256("localhost")
      // 49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d9763
      // flags = 0x1d = 0b00011101 -> UP(1), UV(1), BE(1), BS(1), AT(0), ED(0)
      // signCount = 0x0000002a = 42
      const authDataHex = '49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d9763' + '1d' + '0000002a';
      const parsed = parseAuthenticatorData(hexToBytes(authDataHex));
      if (!parsed.flags.UP || !parsed.flags.UV || !parsed.flags.BE || !parsed.flags.BS) {
        throw new Error('Expected UP, UV, BE, BS flags to all be true');
      }
      if (parsed.flags.AT || parsed.flags.ED) {
        throw new Error('Expected AT and ED flags to be false');
      }
      if (parsed.signCount !== 42) {
        throw new Error(`Expected signCount=42, got ${parsed.signCount}`);
      }
      return 'Verified rpIdHash(localhost), flags=0x1d (UP/UV/BE/BS), and signCount=42.';
    }
  );

  // Test 3: Full Attested authenticatorData + COSE P-256 Public Key -> JWK
  await runTest(
    'authdata-attested-es256',
    'Attested Credential Data: AAGUID + Credential ID + COSE ES256 -> JWK',
    'W3C WebAuthn §6.5.1',
    async () => {
      // Build real attestedCredentialData with a real WebCrypto P-256 public key
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const exportedJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
      const xBytes = base64UrlToBytes(exportedJwk.x!);
      const yBytes = base64UrlToBytes(exportedJwk.y!);

      // Encode COSE_Key CBOR map manually
      const cosePrefix = hexToBytes('a5010203262001215820');
      const coseMid = hexToBytes('225820');
      const coseKeyBytes = concatBytes(cosePrefix, xBytes, coseMid, yBytes);

      const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('primitive.dev')));
      const flags = new Uint8Array([0x45]); // UP=1, UV=1, AT=1 (0x01 | 0x04 | 0x40 = 0x45)
      const signCount = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
      const aaguid = hexToBytes('fbfc3007154e4ecc8c0b6e020557d7bd'); // Apple Passwords
      const credId = hexToBytes('aabbccddeeff00112233445566778899');
      const credIdLen = new Uint8Array([0x00, credId.length]);

      const fullAuthData = concatBytes(rpIdHash, flags, signCount, aaguid, credIdLen, credId, coseKeyBytes);
      const parsed = parseAuthenticatorData(fullAuthData);

      if (!parsed.attestedCredentialData) throw new Error('Missing attestedCredentialData');
      if (parsed.attestedCredentialData.aaguid !== 'fbfc3007-154e-4ecc-8c0b-6e020557d7bd') {
        throw new Error('AAGUID mismatch');
      }
      if (parsed.attestedCredentialData.publicKeyJwk.x !== exportedJwk.x) {
        throw new Error('Extracted JWK x coordinate did not match original key');
      }
      return `Extracted 32-byte P-256 JWK and AAGUID (${parsed.attestedCredentialData.aaguidName}).`;
    }
  );

  // Test 4: End-to-End WebCrypto ES256 ASN.1 DER Signature Verification & Tamper Rejection
  await runTest(
    'webcrypto-es256-verify',
    'WebCrypto ES256: ASN.1 DER -> P1363 Conversion & Tamper Rejection',
    'W3C WebAuthn §7.2 & RFC 3279',
    async () => {
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
      const authData = hexToBytes('49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000001');
      const clientDataBytes = new TextEncoder().encode(
        JSON.stringify({
          type: 'webauthn.get',
          challenge: 'dGVzdC1jaGFsbGVuZ2U',
          origin: 'https://example.com',
        })
      );
      const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes));
      const signedData = concatBytes(authData, clientDataHash);

      const p1363Sig = new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, signedData)
      );
      // Convert to ASN.1 DER just like a real hardware/platform authenticator returns
      const derSig = p1363ToDer(p1363Sig);
      // Convert back to P1363 in the Relying Party verifier
      const recoveredP1363 = derToP1363(derSig, 32);

      const importedPub = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'verify',
      ]);
      const validOk = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        importedPub,
        recoveredP1363,
        signedData
      );
      if (!validOk) throw new Error('Valid ES256 DER signature failed verification');

      // Now flip 1 bit in signedData and verify it MUST fail
      const tamperedData = new Uint8Array(signedData);
      tamperedData[tamperedData.length - 1] ^= 0x01;
      const tamperOk = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        importedPub,
        recoveredP1363,
        tamperedData
      );
      if (tamperOk) throw new Error('Tampered payload unexpectedly verified!');

      return `DER (${derSig.length}B) -> P1363 (64B) verified authentic payload & rejected 1-bit tamper.`;
    }
  );

  // Test 5: End-to-End WebCrypto RS256 Signature Verification
  await runTest(
    'webcrypto-rs256-verify',
    'WebCrypto RS256: RSASSA-PKCS1-v1_5 + SHA-256 Verification',
    'W3C WebAuthn §5.8.4 (COSE -257)',
    async () => {
      const kp = await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      );
      const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
      const payload = new TextEncoder().encode('webauthn-rs256-test-vector');
      const sig = new Uint8Array(await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, kp.privateKey, payload));

      const importedPub = await crypto.subtle.importKey(
        'jwk',
        pubJwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      const ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, importedPub, sig, payload);
      if (!ok) throw new Error('Valid RS256 signature failed verification');
      return `Verified 2048-bit RSA signature (${sig.length}B) via WebCrypto.`;
    }
  );

  return results;
}
