import { Lime, SOURCE_URL } from './Brand';

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--bg)', marginTop: 'auto' }}>
      <div
        className="kl-wrap flex justify-between items-center gap-3 flex-wrap"
        style={{ paddingTop: 24, paddingBottom: 32, fontSize: 13, color: 'var(--ink-3)' }}
      >
        <span className="inline-flex items-center gap-2.5">
          <Lime width={24} />
          keylime is a punnet playground tool · Open source by primitive · Nothing leaves your device.
        </span>
        <span>
          MIT ·{' '}
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            Source
          </a>{' '}
          · Made in Perth
        </span>
      </div>
    </footer>
  );
}
