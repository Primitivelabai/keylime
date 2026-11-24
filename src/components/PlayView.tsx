import type { EnvironmentCapabilities } from '../hooks/useEnvironment';
import type { PasskeyLab } from '../hooks/usePasskeyLab';
import { Exchange } from './Exchange';
import { PasskeyForm } from './PasskeyForm';
import { ResultPanel } from './ResultPanel';

interface PlayViewProps {
  lab: PasskeyLab;
  env: EnvironmentCapabilities;
  onOpenInspector: () => void;
}

export function PlayView({ lab, env, onOpenInspector }: PlayViewProps) {
  return (
    <div className="flex flex-col" style={{ gap: 64 }}>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
          gap: '48px 72px',
          alignItems: 'center',
        }}
      >
        <div className="flex flex-col" style={{ gap: 20 }}>
          <h1
            className="kl-display"
            style={{ margin: 0, fontSize: 'clamp(38px, 7vw, 80px)', lineHeight: 1, letterSpacing: '-0.035em' }}
          >
            Make a passkey. Then try to <span className="kl-hl">break it</span>
            <span style={{ color: 'var(--dot)' }}>.</span>
          </h1>
          <p style={{ margin: 0, maxWidth: '46ch', fontSize: 18, color: 'var(--ink-2)' }}>
            Your device on one side, a tiny website on the other, both in this tab. Nothing leaves your device.
          </p>
        </div>
        <PasskeyForm lab={lab} env={env} />
      </section>

      <Exchange lab={lab} />

      {lab.lastAssertionResult && (
        <ResultPanel result={lab.lastAssertionResult} record={lab.storedRecord} onOpenInspector={onOpenInspector} />
      )}
    </div>
  );
}
