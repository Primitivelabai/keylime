# Contributing to keylime

Thanks for wanting to help. keylime is small on purpose, so most changes are small too.

## Good places to start

- **A new attack.** Attacks live in `src/lib/webauthn.ts` and the cards in `src/components/BreakView.tsx`. Each one edits a copy of your last real sign-in and hands it to the in-page website. Pick something the website should catch, and say which check catches it.
- **A new algorithm.** The website checks ES256 and RS256 today (`src/lib/rp.ts`). EdDSA would be welcome.
- **A spec test.** `src/lib/specTests.ts` runs known WebAuthn vectors in the browser.
- **Clearer words.** If a screen confused you, that is a bug. Open an issue with a screenshot.

Issues labelled `good first issue` are sized for a first pull request.

## Set up

    npm install
    npm run dev
    npm test

Before you open a pull request:

    npm run typecheck
    npm test
    npm run format:check

## Rules of the house

- **Nothing leaves the device.** No servers, analytics, remote fonts or network calls after load. Pull requests that add one won't be merged.
- **Real or nothing.** Every check and attack must do what it says, with real WebAuthn and WebCrypto. No mocked results on screen.
- **Plain words.** Write for someone who has never heard of CBOR. Put the detail in the inspector.
- **One change per pull request**, with a test when it touches `src/lib`.

## Security

Found a way past one of the checks? Please read [SECURITY.md](SECURITY.md) first.
