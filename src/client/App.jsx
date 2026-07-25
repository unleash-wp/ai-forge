// Core shell: composes the header, tool rail, active tool plugin, shared setup
// wizard and first-run installer. Brand = UnleashWP, platform = Forge; tools live
// under it. Every piece is its own component in ./components/.
import { useState, useEffect, useCallback, useRef } from 'react';
import { CoreContext, useToast } from './core.jsx';
import REGISTRY from './registry.js';
import Header from './components/Header.jsx';
import Rail from './components/Rail.jsx';
import Footer from './components/Footer.jsx';
import UpdateNote from './components/UpdateNote.jsx';
import Installer from './components/Installer.jsx';
import SetupWizard from './components/SetupWizard.jsx';
import PluginsManager from './components/PluginsManager.jsx';

const PLUGINS_VIEW = '__plugins__';

export default function App() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const railRef = useRef(null);
  const headerRef = useRef(null);
  const wizardRef = useRef(null);

  const refreshStatus = useCallback(() => {
    return fetch('/api/config/status').then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  // (Re)load the plugin list; keep the active tool valid (enabled), else fall back.
  const loadPluginList = useCallback(() => {
    return fetch('/api/plugins').then((r) => r.json()).then((d) => {
      const list = d.plugins || [];
      setPlugins(list);
      setActiveId((cur) => {
        if (cur === PLUGINS_VIEW) return cur;
        const enabled = list.filter((p) => p.enabled !== false);
        if (cur && enabled.some((p) => p.id === cur)) return cur;
        return enabled.length ? enabled[0].id : PLUGINS_VIEW;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => { loadPluginList(); refreshStatus(); }, [loadPluginList, refreshStatus]);

  const installing = status && !status.installed;
  useEffect(() => { document.body.classList.toggle('installing', !!installing); }, [installing]);

  // pin the rail under the sticky header + shadow the header on scroll
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 4); }
    function place() { if (railRef.current && headerRef.current) railRef.current.style.top = (headerRef.current.offsetHeight + 12) + 'px'; }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', place);
    place(); onScroll();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', place); };
  });

  const openSetup = useCallback(() => setWizardOpen(true), []);
  useEffect(() => {
    if (wizardOpen && wizardRef.current) wizardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    function onKey(e) { if (e.key === 'Escape') setWizardOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [wizardOpen]);

  const gh = status && status.github, trac = status && status.trac;
  const inPlugins = activeId === PLUGINS_VIEW;
  const active = plugins.find((p) => p.id === activeId);
  const ActiveTool = activeId && !inPlugins ? REGISTRY[activeId] : null;
  const coreApi = { toast, openSetup, status, refreshStatus };

  return (
    <CoreContext.Provider value={coreApi}>
      {installing && <Installer status={status} onDone={refreshStatus} />}

      <Header headerRef={headerRef} scrolled={scrolled} ghSet={!!(gh && gh.set)} tracSet={!!(trac && trac.set)} onToggleSetup={() => setWizardOpen((o) => !o)} />

      <div className="shell">
        <Rail railRef={railRef} plugins={plugins} activeId={activeId} inPlugins={inPlugins} onSelect={setActiveId} onPlugins={() => setActiveId(PLUGINS_VIEW)} />
        <main>
          <UpdateNote />
          <div className="tool-head">
            <h1>{inPlugins ? 'Plugins' : (active ? active.name : 'WP Changelog')}</h1>
            <p>{inPlugins ? 'Tools installed on this Forge. Every tool is a plugin. Add your own.' : (active ? active.description : '')}</p>
          </div>
          {inPlugins ? <PluginsManager plugins={plugins} onOpen={setActiveId} onChanged={loadPluginList} /> : (ActiveTool && <ActiveTool />)}
          <div ref={wizardRef}>
            <SetupWizard status={status} refreshStatus={refreshStatus} open={wizardOpen} onClose={() => setWizardOpen(false)} />
          </div>
        </main>
      </div>

      <Footer />
    </CoreContext.Provider>
  );
}
