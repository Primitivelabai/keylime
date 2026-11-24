import type { Bytes } from './encoding';
import { bytesToBase64Url, bytesToHex } from './encoding';
import { decodeCBORItem, type CBORValue } from './cbor';

export interface AuthenticatorFlags {
  rawByte: number;
  UP: boolean; // Bit 0 (0x01): User Present
  UV: boolean; // Bit 2 (0x04): User Verified
  BE: boolean; // Bit 3 (0x08): Backup Eligible (Passkey sync capable)
  BS: boolean; // Bit 4 (0x10): Backup State (Currently backed up / synced)
  AT: boolean; // Bit 6 (0x40): Attested credential data included
  ED: boolean; // Bit 7 (0x80): Extension data included
}

export interface ParsedAuthenticatorData {
  rawHex: string;
  byteLength: number;
  rpIdHashHex: string;
  rpIdHashBytes: Bytes;
  flags: AuthenticatorFlags;
  signCount: number;
  attestedCredentialData?: {
    aaguid: string;
    aaguidName: string;
    credentialIdHex: string;
    credentialIdBase64Url: string;
    credentialPublicKeyHex: string;
    coseMap: Map<CBORValue, CBORValue>;
    publicKeyJwk: JsonWebKey;
    coseAlg: number;
    algorithmName: string;
  };
  extensions?: Map<CBORValue, CBORValue>;
}

/**
 * Known Authenticator Attestation GUIDs (AAGUIDs) from FIDO MDS / community registry.
 */
const KNOWN_AAGUIDS: Record<string, string> = {
  '00000000-0000-0000-0000-000000000000': 'Software / Unspecified Authenticator',
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'Apple Passwords / iCloud Keychain',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'Apple iCloud Keychain (Touch ID / Face ID)',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on macOS Touch ID',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello (Hardware TPM)',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello (Software)',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  '2fc0579f-8113-47ea-b116-bb5a8db9202a': 'YubiKey 5 Series',
  'cb69481e-8ff7-4039-93ec-0a2729a154a8': 'YubiKey 5 NFC',
  'ee882879-721c-4913-9775-3dfcce97072a': 'YubiKey 5 FIPS',
};

function formatAaguid(bytes: Bytes): string {
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Converts a decoded CBOR COSE_Key Map into a standard WebCrypto JsonWebKey (JWK).
 * Supports ES256 (COSE alg -7, EC2 P-256) and RS256 (COSE alg -257, RSA).
 */
function coseKeyToJwk(coseMap: Map<CBORValue, CBORValue>): {
  jwk: JsonWebKey;
  alg: number;
  algorithmName: string;
} {
  const kty = coseMap.get(1);
  const alg = coseMap.get(3);

  // ES256: EC2 (kty = 2), alg = -7, crv = P-256 (-1 = 1)
  if (kty === 2 && alg === -7) {
    const crv = coseMap.get(-1);
    const x = coseMap.get(-2);
    const y = coseMap.get(-3);
    if (crv !== 1) {
      throw new Error(`Unsupported EC2 curve (${String(crv)}). Expected P-256 (1).`);
    }
    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
      throw new Error('Invalid COSE EC2 key: missing x or y coordinate byte strings.');
    }
    return {
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: bytesToBase64Url(x),
        y: bytesToBase64Url(y),
        ext: true,
      },
      alg: -7,
      algorithmName: 'ES256 (ECDSA P-256 + SHA-256)',
    };
  }

  // RS256: RSA (kty = 3), alg = -257
  if (kty === 3 && alg === -257) {
    const n = coseMap.get(-1);
    const e = coseMap.get(-2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array)) {
      throw new Error('Invalid COSE RSA key: missing modulus (n) or exponent (e).');
    }
    return {
      jwk: {
        kty: 'RSA',
        alg: 'RS256',
        n: bytesToBase64Url(n),
        e: bytesToBase64Url(e),
        ext: true,
      },
      alg: -257,
      algorithmName: 'RS256 (RSASSA-PKCS1-v1_5 + SHA-256)',
    };
  }

  throw new Error(
    `Unsupported COSE key parameters: kty=${String(kty)}, alg=${String(alg)}. Playground supports ES256 (-7) and RS256 (-257).`
  );
}

/**
 * Parses raw WebAuthn `authenticatorData` bytes according to W3C WebAuthn §6.1.
 */
export function parseAuthenticatorData(authDataBytes: Bytes): ParsedAuthenticatorData {
  if (authDataBytes.byteLength < 37) {
    throw new Error(`authenticatorData too short (${authDataBytes.byteLength} bytes; minimum 37 required).`);
  }

  const view = new DataView(authDataBytes.buffer, authDataBytes.byteOffset, authDataBytes.byteLength);
  const rpIdHashBytes = authDataBytes.slice(0, 32);
  const flagsByte = authDataBytes[32];
  const signCount = view.getUint32(33, false);

  const flags: AuthenticatorFlags = {
    rawByte: flagsByte,
    UP: Boolean(flagsByte & 0x01),
    UV: Boolean(flagsByte & 0x04),
    BE: Boolean(flagsByte & 0x08),
    BS: Boolean(flagsByte & 0x10),
    AT: Boolean(flagsByte & 0x40),
    ED: Boolean(flagsByte & 0x80),
  };

  let cursor = 37;
  let attestedCredentialData: ParsedAuthenticatorData['attestedCredentialData'];

  if (flags.AT) {
    if (authDataBytes.byteLength < cursor + 18) {
      throw new Error('AT flag is set, but buffer ends before AAGUID and credentialIdLength.');
    }
    const aaguidBytes = authDataBytes.slice(cursor, cursor + 16);
    const aaguid = formatAaguid(aaguidBytes);
    const aaguidName = KNOWN_AAGUIDS[aaguid] ?? 'Not in our list yet';
    cursor += 16;

    const credIdLen = view.getUint16(cursor, false);
    cursor += 2;

    if (authDataBytes.byteLength < cursor + credIdLen) {
      throw new Error('Buffer ends before credentialId completes.');
    }
    const credentialIdBytes = authDataBytes.slice(cursor, cursor + credIdLen);
    cursor += credIdLen;

    const pubKeyStart = cursor;
    const decodedPubKey = decodeCBORItem(authDataBytes, pubKeyStart);
    cursor = decodedPubKey.nextOffset;

    if (!(decodedPubKey.value instanceof Map)) {
      throw new Error('credentialPublicKey did not decode into a CBOR map.');
    }

    const { jwk, alg, algorithmName } = coseKeyToJwk(decodedPubKey.value);

    attestedCredentialData = {
      aaguid,
      aaguidName,
      credentialIdHex: bytesToHex(credentialIdBytes),
      credentialIdBase64Url: bytesToBase64Url(credentialIdBytes),
      credentialPublicKeyHex: bytesToHex(authDataBytes.slice(pubKeyStart, cursor)),
      coseMap: decodedPubKey.value,
      publicKeyJwk: jwk,
      coseAlg: alg,
      algorithmName,
    };
  }

  let extensions: Map<CBORValue, CBORValue> | undefined;
  if (flags.ED && cursor < authDataBytes.byteLength) {
    const decodedExt = decodeCBORItem(authDataBytes, cursor);
    if (decodedExt.value instanceof Map) {
      extensions = decodedExt.value;
    }
  }

  return {
    rawHex: bytesToHex(authDataBytes),
    byteLength: authDataBytes.byteLength,
    rpIdHashHex: bytesToHex(rpIdHashBytes),
    rpIdHashBytes,
    flags,
    signCount,
    attestedCredentialData,
    extensions,
  };
}

/**
 * Converts an ASN.1 DER-encoded ECDSA signature (returned by WebAuthn authenticators)
 * into a 64-byte IEEE P1363 `(r || s)` buffer required by WebCrypto `ECDSA` `verify()`.
 */
export function derToP1363(der: Bytes, coordinateBytes = 32): Bytes {
  if (der.length < 8 || der[0] !== 0x30) {
    throw new Error('Invalid ASN.1 DER signature: missing SEQUENCE header (0x30).');
  }

  let offset = 2;
  if (der[1] & 0x80) {
    const lenOctets = der[1] & 0x7f;
    offset = 2 + lenOctets;
  }

  if (der[offset] !== 0x02) {
    throw new Error('Invalid ASN.1 DER signature: missing INTEGER tag (0x02) for R.');
  }
  const rLen = der[offset + 1];
  const rStart = offset + 2;
  if (rStart + rLen > der.length) {
    throw new Error('Invalid ASN.1 DER signature: R integer exceeds buffer.');
  }
  const rRaw = der.slice(rStart, rStart + rLen);
  offset = rStart + rLen;

  if (der[offset] !== 0x02) {
    throw new Error('Invalid ASN.1 DER signature: missing INTEGER tag (0x02) for S.');
  }
  const sLen = der[offset + 1];
  const sStart = offset + 2;
  if (sStart + sLen > der.length) {
    throw new Error('Invalid ASN.1 DER signature: S integer exceeds buffer.');
  }
  const sRaw = der.slice(sStart, sStart + sLen);

  // Strip leading 0x00 sign-padding byte if present
  const rTrimmed = rRaw.length > coordinateBytes && rRaw[0] === 0x00 ? rRaw.slice(rRaw.length - coordinateBytes) : rRaw;
  const sTrimmed = sRaw.length > coordinateBytes && sRaw[0] === 0x00 ? sRaw.slice(sRaw.length - coordinateBytes) : sRaw;

  if (rTrimmed.length > coordinateBytes || sTrimmed.length > coordinateBytes) {
    throw new Error('ECDSA signature scalar exceeds 32 bytes for P-256.');
  }

  const p1363 = new Uint8Array(coordinateBytes * 2);
  p1363.set(rTrimmed, coordinateBytes - rTrimmed.length);
  p1363.set(sTrimmed, coordinateBytes * 2 - sTrimmed.length);
  return p1363;
}

/**
 * Encodes a 64-byte IEEE P1363 `(r || s)` ECDSA signature into ASN.1 DER format.
 * Used in our WebAuthn spec unit test suite to simulate real authenticator output.
 */
export function p1363ToDer(p1363: Bytes): Bytes {
  const half = p1363.length / 2;
  const encodeInt = (bytes: Bytes): Bytes => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0x00) start++;
    const trimmed = bytes.slice(start);
    const needsPad = (trimmed[0] & 0x80) !== 0;
    const len = trimmed.length + (needsPad ? 1 : 0);
    const out = new Uint8Array(2 + len);
    out[0] = 0x02;
    out[1] = len;
    if (needsPad) {
      out[2] = 0x00;
      out.set(trimmed, 3);
    } else {
      out.set(trimmed, 2);
    }
    return out;
  };
  const rDer = encodeInt(p1363.slice(0, half));
  const sDer = encodeInt(p1363.slice(half));
  const seq = new Uint8Array(2 + rDer.length + sDer.length);
  seq[0] = 0x30;
  seq[1] = rDer.length + sDer.length;
  seq.set(rDer, 2);
  seq.set(sDer, 2 + rDer.length);
  return seq;
}
