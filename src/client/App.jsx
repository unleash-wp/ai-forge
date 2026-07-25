// Core shell: composes the header, tool rail, active tool plugin, shared setup
// wizard and first-run installer. Brand = UnleashWP, platform = Forge; tools live
// under it. Every piece is its own component in ./components/.
import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Grid, Heading, Text } from '@chakra-ui/react';
import { CoreContext, useToast } from './core.jsx';
import { useT } from './i18n.jsx';
import { applyFilters, doAction, hooks } from './hooks.js';
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
  const t = useT();
  const [status, setStatus] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [scrolled, setScrolled] = useState(false);
  const railRef = useRef(null);
  const headerRef = useRef(null);

  const refreshStatus = useCallback(() => {
    return fetch('/api/config/status').then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  // (Re)load the plugin list; keep the active tool valid (enabled), else fall back.
  const loadPluginList = useCallback(() => {
    return fetch('/api/plugins').then((r) => r.json()).then((d) => {
      // Plugins can add, hide or reorder tools in the rail via this filter.
      const list = applyFilters('forge.plugins', d.plugins || []);
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
  useEffect(() => { document.body.classList.toggle('is-installing', !!installing); }, [installing]);

  // pin the rail under the sticky header + shadow the header on scroll
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 4); }
    function place() { if (railRef.current && headerRef.current) railRef.current.style.top = (headerRef.current.offsetHeight + 12) + 'px'; }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', place);
    place(); onScroll();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', place); };
  }, []);

  const openSettings = useCallback((tab = 'general') => { setSettingsTab(tab); setWizardOpen(true); }, []);
  const openSetup = useCallback(() => openSettings('connectors'), [openSettings]);

  // Let tools react when they become the active tool.
  useEffect(() => { if (activeId && activeId !== PLUGINS_VIEW) doAction('forge.tool.open', activeId); }, [activeId]);

  const inPlugins = activeId === PLUGINS_VIEW;
  const active = plugins.find((p) => p.id === activeId);
  const ActiveTool = activeId && !inPlugins ? REGISTRY[activeId] : null;
  const coreApi = { toast, openSetup, status, refreshStatus, hooks };

  return (
    <CoreContext.Provider value={coreApi}>
      {installing && <Installer status={status} onDone={refreshStatus} />}

      <Header headerRef={headerRef} scrolled={scrolled} onOpenSettings={() => openSettings('general')} />

      <Grid maxW="72.5rem" mx="auto" px={{ base: '4', lg: '6' }} gap={{ base: '4', lg: '8' }} alignItems="start"
        templateColumns={{ base: '1fr', lg: '7.75rem minmax(0, 1fr)' }}>
        <Rail railRef={railRef} plugins={plugins} activeId={activeId} inPlugins={inPlugins} onSelect={setActiveId} onPlugins={() => setActiveId(PLUGINS_VIEW)} />
        <Box as="main" minW="0" pt={{ base: '4', lg: '8' }} pb="16">
          <UpdateNote />
          <Box mb="6">
            <Heading as="h1" fontWeight="700" color="ui.heading" letterSpacing="-.02em" mb="1.5"
              fontSize={{ base: '1.375rem', lg: 'clamp(1.5rem, 1.28rem + 1.1vw, 1.75rem)' }}>
              {inPlugins ? t('Plugins') : (active ? t(active.name) : 'Changelog')}
            </Heading>
            <Text color="ui.muted" fontSize="0.9688rem" maxW="68ch" lineHeight="1.55">
              {inPlugins ? t('Tools installed on UnleashWP Forge. Every tool is a plugin. Add your own.') : (active ? t(active.description) : '')}
            </Text>
          </Box>
          {inPlugins ? <PluginsManager plugins={plugins} onOpen={setActiveId} onChanged={loadPluginList} /> : (ActiveTool && <ActiveTool />)}
        </Box>
      </Grid>

      <SetupWizard status={status} refreshStatus={refreshStatus} open={wizardOpen} initialTab={settingsTab} onClose={() => setWizardOpen(false)} />

      <Footer version={status && status.version} onCredits={() => openSettings('credits')} />
    </CoreContext.Provider>
  );
}
