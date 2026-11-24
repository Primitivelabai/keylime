import { GithubIcon, Lime, PunnetMark, SOURCE_URL } from './Brand';

export type TabId = 'play' | 'break' | 'phishing' | 'spec' | 'about';

export const TABS: { id: TabId; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'break', label: 'Break it' },
  { id: 'phishing', label: 'Phishing story' },
  { id: 'spec', label: 'Spec tests' },
  { id: 'about', label: 'About' },
];

export function tabHref(id: TabId): string {
  return id === 'play' ? '#' : `#${id}`;
}

interface HeaderProps {
  activeTab: TabId;
  onOpenInspector: () => void;
  hasCapture: boolean;
}

export function Header({ activeTab, onOpenInspector, hasCapture }: HeaderProps) {
  return (
    <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
      <div className="kl-wrap" style={{ paddingTop: 16 }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5" style={{ fontSize: 15 }}>
            <span className="hidden sm:inline-flex items-center gap-2">
              <PunnetMark />
              <span className="kl-display" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
                punnet
              </span>
            </span>
            <span className="hidden sm:inline" style={{ color: 'var(--ink-3)' }} aria-hidden="true">
              /
            </span>
            <span className="hidden sm:inline" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
              playground
            </span>
            <span className="hidden sm:inline" style={{ color: 'var(--ink-3)' }} aria-hidden="true">
              /
            </span>
            <a
              href="#"
              className="kl-display inline-flex items-center gap-2"
              style={{ fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)', textDecoration: 'none' }}
            >
              <Lime width={24} />
              keylime
            </a>
          </div>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 8,
              background: 'var(--ink)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <GithubIcon />
            Open source
          </a>
        </div>

        <nav
          aria-label="Sections"
          className="flex overflow-x-auto"
          style={{ gap: 28, marginTop: 14, fontSize: 14, fontWeight: 500 }}
        >
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <a
                key={tab.id}
                href={tabHref(tab.id)}
                aria-current={active ? 'page' : undefined}
                style={{
                  padding: '10px 0 12px',
                  borderBottom: `3px solid ${active ? 'var(--lime)' : 'transparent'}`,
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </a>
            );
          })}
          <button
            type="button"
            onClick={onOpenInspector}
            className="inline-flex items-center gap-2"
            style={{
              padding: '10px 0 12px',
              marginLeft: 'auto',
              border: 0,
              borderBottom: '3px solid transparent',
              background: 'transparent',
              color: 'var(--ink-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            Inspector
            {hasCapture && (
              <>
                <span
                  aria-hidden="true"
                  style={{ width: 7, height: 7, background: 'var(--lime)', border: '1px solid var(--hard)' }}
                />
                <span className="sr-only">(has data)</span>
              </>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
