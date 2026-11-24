import type { Bytes } from './encoding';
export type CBORValue =
  number | bigint | string | boolean | null | undefined | Bytes | CBORValue[] | Map<CBORValue, CBORValue>;

/**
 * Decodes a single CBOR item starting at `offset` and returns both the decoded
 * JavaScript value and the exact `nextOffset` in the byte buffer.
 * Tracking `nextOffset` is critical in WebAuthn because `authenticatorData`
 * embeds a variable-length CBOR COSE_Key map followed optionally by CBOR extensions.
 */
export function decodeCBORItem(data: Bytes, offset = 0): { value: CBORValue; nextOffset: number } {
  if (offset >= data.length) {
    throw new Error(`CBOR decode error: unexpected end of input at offset ${offset}`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const initialByte = data[offset];
  const majorType = initialByte >> 5;
  const additionalInfo = initialByte & 0x1f;
  let cursor = offset + 1;

  const readArgument = (): { arg: number; bigArg?: bigint } => {
    if (additionalInfo < 24) {
      return { arg: additionalInfo };
    }
    if (additionalInfo === 24) {
      if (cursor + 1 > data.length) throw new Error('CBOR truncated uint8');
      const val = data[cursor];
      cursor += 1;
      return { arg: val };
    }
    if (additionalInfo === 25) {
      if (cursor + 2 > data.length) throw new Error('CBOR truncated uint16');
      const val = view.getUint16(cursor, false);
      cursor += 2;
      return { arg: val };
    }
    if (additionalInfo === 26) {
      if (cursor + 4 > data.length) throw new Error('CBOR truncated uint32');
      const val = view.getUint32(cursor, false);
      cursor += 4;
      return { arg: val };
    }
    if (additionalInfo === 27) {
      if (cursor + 8 > data.length) throw new Error('CBOR truncated uint64');
      const hi = view.getUint32(cursor, false);
      const lo = view.getUint32(cursor + 4, false);
      cursor += 8;
      const numVal = hi * 4294967296 + lo;
      const bigVal = typeof BigInt === 'function' ? BigInt(hi) * BigInt(4294967296) + BigInt(lo) : undefined;
      return { arg: numVal, bigArg: bigVal };
    }
    throw new Error(`CBOR unsupported additional info: ${additionalInfo}`);
  };

  // Major Type 0: Unsigned integer
  if (majorType === 0) {
    const { arg, bigArg } = readArgument();
    if (bigArg !== undefined && bigArg > BigInt(Number.MAX_SAFE_INTEGER)) {
      return { value: bigArg, nextOffset: cursor };
    }
    return { value: arg, nextOffset: cursor };
  }

  // Major Type 1: Negative integer (-1 - N)
  if (majorType === 1) {
    const { arg, bigArg } = readArgument();
    if (bigArg !== undefined && bigArg > BigInt(Number.MAX_SAFE_INTEGER)) {
      return { value: BigInt(-1) - bigArg, nextOffset: cursor };
    }
    return { value: -1 - arg, nextOffset: cursor };
  }

  // Major Type 2: Byte string
  if (majorType === 2) {
    const { arg: len } = readArgument();
    if (cursor + len > data.length) {
      throw new Error(`CBOR byte string exceeds buffer length (${cursor + len} > ${data.length})`);
    }
    const bytes = data.slice(cursor, cursor + len);
    return { value: bytes, nextOffset: cursor + len };
  }

  // Major Type 3: UTF-8 text string
  if (majorType === 3) {
    const { arg: len } = readArgument();
    if (cursor + len > data.length) {
      throw new Error(`CBOR text string exceeds buffer length (${cursor + len} > ${data.length})`);
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data.slice(cursor, cursor + len));
    return { value: text, nextOffset: cursor + len };
  }

  // Major Type 4: Array
  if (majorType === 4) {
    const { arg: count } = readArgument();
    const arr: CBORValue[] = [];
    for (let i = 0; i < count; i++) {
      const item = decodeCBORItem(data, cursor);
      arr.push(item.value);
      cursor = item.nextOffset;
    }
    return { value: arr, nextOffset: cursor };
  }

  // Major Type 5: Map (Preserves integer keys required by COSE_Key, e.g., -1, -2, -3)
  if (majorType === 5) {
    const { arg: count } = readArgument();
    const map = new Map<CBORValue, CBORValue>();
    for (let i = 0; i < count; i++) {
      const keyItem = decodeCBORItem(data, cursor);
      cursor = keyItem.nextOffset;
      const valItem = decodeCBORItem(data, cursor);
      cursor = valItem.nextOffset;
      map.set(keyItem.value, valItem.value);
    }
    return { value: map, nextOffset: cursor };
  }

  // Major Type 6: Semantic Tag
  if (majorType === 6) {
    readArgument(); // Consume tag number
    return decodeCBORItem(data, cursor);
  }

  // Major Type 7: Floating-Point Numbers and Simple Values
  if (majorType === 7) {
    if (additionalInfo === 20) return { value: false, nextOffset: cursor };
    if (additionalInfo === 21) return { value: true, nextOffset: cursor };
    if (additionalInfo === 22) return { value: null, nextOffset: cursor };
    if (additionalInfo === 23) return { value: undefined, nextOffset: cursor };
    if (additionalInfo === 25) {
      // IEEE 754 Half-Precision Float (16-bit)
      if (cursor + 2 > data.length) throw new Error('CBOR truncated float16');
      const half = view.getUint16(cursor, false);
      cursor += 2;
      const exp = (half >> 10) & 0x1f;
      const mant = half & 0x03ff;
      let val: number;
      if (exp === 0) val = mant * Math.pow(2, -24);
      else if (exp !== 31) val = (mant + 1024) * Math.pow(2, exp - 25);
      else val = mant === 0 ? Infinity : NaN;
      return { value: half & 0x8000 ? -val : val, nextOffset: cursor };
    }
    if (additionalInfo === 26) {
      if (cursor + 4 > data.length) throw new Error('CBOR truncated float32');
      const val = view.getFloat32(cursor, false);
      return { value: val, nextOffset: cursor + 4 };
    }
    if (additionalInfo === 27) {
      if (cursor + 8 > data.length) throw new Error('CBOR truncated float64');
      const val = view.getFloat64(cursor, false);
      return { value: val, nextOffset: cursor + 8 };
    }
  }

  throw new Error(`CBOR unsupported major type ${majorType} with additional info ${additionalInfo}`);
}

/**
 * Convenience wrapper to decode a complete CBOR buffer.
 */
export function decodeCBOR(data: Bytes): CBORValue {
  return decodeCBORItem(data, 0).value;
}
