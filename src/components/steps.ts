import type { Phase } from '../hooks/usePasskeyLab';

export type Side = 'device' | 'website';

export interface ProtocolStep {
  side: Side;
  title: string;
  detail: string;
}

export const STEPS: Record<Phase, ProtocolStep[]> = {
  register: [
    { side: 'website', title: 'The website sends a challenge', detail: 'A random one-time code.' },
    { side: 'device', title: 'You confirm', detail: 'Face, fingerprint or PIN. Your device makes a new key pair.' },
    { side: 'device', title: 'Your device sends the public key', detail: 'The private key never leaves it.' },
    { side: 'website', title: 'The website saves it', detail: 'Only the public key. Nothing secret.' },
  ],
  signin: [
    { side: 'website', title: 'The website sends a challenge', detail: 'A fresh one-time code.' },
    { side: 'device', title: 'You confirm', detail: 'Nothing is signed until you do.' },
    { side: 'device', title: 'Your device signs it', detail: 'With the private key, for this site only.' },
    { side: 'website', title: 'The website checks', detail: 'Seven checks, the signature last.' },
  ],
};

/** Shortens a long base64url value for display: first 4 and last 4 characters. */
export function shortId(value: string, head = 4, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
