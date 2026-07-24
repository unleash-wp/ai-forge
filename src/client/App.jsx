// Core shell: header + tool rail (from /api/plugins) + the active tool plugin +
// the shared setup wizard + first-run installer. Brand = UnleashWP, platform =
// Forge; tools live under it. The shell knows nothing tool-specific.
import { useState, useEffect, useCallback, useRef } from 'react';
import { CoreContext, useToast } from './core.jsx';
import { LOGO_FULL } from './brand.js';
import Installer from './Installer.jsx';
import SetupWizard from './SetupWizard.jsx';
import PluginsManager from './PluginsManager.jsx';
import REGISTRY from './registry.js';
import { ToolIcon, PluginsIcon } from './icons.jsx';

const PLUGINS_VIEW = '__plugins__';

// Non-blocking "update available" note (free, via GitHub Releases). Never
// downloads code - just links the release notes.
function UpdateNote() {
  const [updates, setUpdates] = useState([]);
  useEffect(() => {
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  if (!updates.length) return null;
  return (
    <div className="warn">
      {updates.map((u) => (
        <div key={u.id}>Update available: <b>{u.name}</b> {u.current} → {u.latest}. <a href={u.url} target="_blank" rel="noopener">Release notes</a></div>
      ))}
    </div>
  );
}

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

      <header ref={headerRef} className={scrolled ? 'scrolled' : ''}>
        <div className="bar">
          <a className="logo" href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP" dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
          <span className="divider" />
          <a href="#" className="product" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Forge</a>
          <div className="pills">
            <button className={'pill ' + (gh && gh.set ? 'ok' : 'off')} onClick={() => setWizardOpen((o) => !o)}><span className="ic" />GitHub</button>
            <button className={'pill ' + (trac && trac.set ? 'ok' : 'off')} onClick={() => setWizardOpen((o) => !o)}><span className="ic" />Trac</button>
          </div>
        </div>
      </header>

      <div className="shell">
        <aside className="rail" ref={railRef}>
          <span className="rail-cap">Tools</span>
          <div id="railTools">
            {plugins.filter((p) => p.enabled !== false).map((p) => (
              <button key={p.id} type="button" className={'tool' + (p.id === activeId ? ' active' : '')} aria-current={p.id === activeId ? 'true' : undefined} onClick={() => setActiveId(p.id)}>
                <span className="tool-ic"><ToolIcon name={p.icon} size={18} /></span>
                <span className="tool-name">{p.name}</span>
              </button>
            ))}
            <button type="button" className={'tool tool--plugins' + (inPlugins ? ' active' : '')} aria-current={inPlugins ? 'true' : undefined} onClick={() => setActiveId(PLUGINS_VIEW)}>
              <span className="tool-ic"><PluginsIcon size={18} /></span>
              <span className="tool-name">Plugins</span>
            </button>
          </div>
        </aside>
        <main>
          <UpdateNote />
          <div className="tool-head">
            <h1>{inPlugins ? 'Plugins' : (active ? active.name : 'WP Changelog')}</h1>
            <p>{inPlugins ? 'Tools installed on this Forge. Every tool is a plugin - add your own.' : (active ? active.description : '')}</p>
          </div>
          {inPlugins ? <PluginsManager plugins={plugins} onOpen={setActiveId} onChanged={loadPluginList} /> : (ActiveTool && <ActiveTool />)}
          <div ref={wizardRef}>
            <SetupWizard status={status} refreshStatus={refreshStatus} open={wizardOpen} onClose={() => setWizardOpen(false)} />
          </div>
        </main>
      </div>

      <footer className="site-footer">
        <div className="finner">
          <div className="fleft">
            <span>&copy; {new Date().getFullYear()} <a href="https://unleash-wp.com" target="_blank" rel="noopener">UnleashWP</a> · Benjamin Zekavica · data via <a href="https://github.com/Automattic/mcp-context-wporg" target="_blank" rel="noopener">Automattic mcp-context-wporg</a></span>
            <span className="fnote">Independent project, not affiliated with Automattic or the WordPress project.</span>
          </div>
          <a className="ficon" href="https://github.com/unleash-wp/wp-release-helper" target="_blank" rel="noopener" aria-label="Contribute on GitHub" title="Contribute on GitHub"><svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>
        </div>
      </footer>
    </CoreContext.Provider>
  );
}
