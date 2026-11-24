import { useCallback, useEffect, useState } from 'react';
import { AboutView } from './components/AboutView';
import { BreakView } from './components/BreakView';
import { CapabilityStrip } from './components/CapabilityStrip';
import { Footer } from './components/Footer';
import { Header, TABS, type TabId } from './components/Header';
import { InspectorDrawer } from './components/InspectorDrawer';
import { PhishingView } from './components/PhishingView';
import { PlayView } from './components/PlayView';
import { SpecView } from './components/SpecView';
import { useEnvironment, usePrefersReducedMotion } from './hooks/useEnvironment';
import { usePasskeyLab } from './hooks/usePasskeyLab';
import type { AssertionVerificationResult } from './lib/rp';

function tabFromHash(): TabId {
  const id = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'play';
}

/** The active tab lives in the URL hash, so tabs are plain links and can be shared. */
function useHashTab(): TabId {
  const [tab, setTab] = useState<TabId>(tabFromHash);
  useEffect(() => {
    const onHashChange = () => {
      setTab(tabFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return tab;
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  const [env, setEnv] = useEnvironment();
  const lab = usePasskeyLab(env, setEnv, reducedMotion);
  const tab = useHashTab();

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspected, setInspected] = useState<AssertionVerificationResult | null>(null);

  const openInspector = useCallback((result: AssertionVerificationResult | null = null) => {
    setInspected(result);
    setInspectorOpen(true);
  }, []);
  const closeInspector = useCallback(() => setInspectorOpen(false), []);

  const shownResult = inspected ?? lab.lastAssertionResult;

  return (
    <div className="kl-page">
      <a
        href="#main"
        className="sr-only focus:not-sr-only"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <Header
        activeTab={tab}
        onOpenInspector={() => openInspector()}
        hasCapture={!!(lab.storedRecord || lab.lastAssertionResult)}
      />
      <CapabilityStrip env={env} />

      <main
        id="main"
        tabIndex={-1}
        className="kl-wrap"
        style={{ paddingTop: 'clamp(40px, 6vw, 72px)', paddingBottom: 72, flex: 1 }}
      >
        {tab === 'play' && <PlayView lab={lab} env={env} onOpenInspector={() => openInspector()} />}
        {tab === 'break' && <BreakView lab={lab} onInspect={openInspector} />}
        {tab === 'phishing' && <PhishingView />}
        {tab === 'spec' && <SpecView />}
        {tab === 'about' && <AboutView />}
      </main>

      <Footer />

      <InspectorDrawer
        open={inspectorOpen}
        onClose={closeInspector}
        record={lab.storedRecord}
        result={shownResult}
        bundle={inspected ? null : lab.lastAssertionBundle}
      />
    </div>
  );
}
