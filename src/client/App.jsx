// Core shell: composes the header, tool rail, active tool plugin, shared setup
// wizard and first-run installer. Brand = UnleashWP, platform = Forge; tools live
// under it. Every piece is its own component in ./components/.
import { useState, useEffect, useCallback } from 'react';
import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { CoreContext, useToast, apiFetch, isReadOnly } from './core.jsx';
import { useT } from './i18n.jsx';
import { applyFilters, doAction, hooks } from './hooks.js';
import { shouldRunInstaller } from './install-gate.js';
import REGISTRY from './registry.js';
import Header from './components/Header.jsx';
import Rail from './components/Rail.jsx';
import Footer from './components/Footer.jsx';
import Installer from './components/Installer.jsx';
import SetupWizard from './components/SetupWizard.jsx';
import PluginsManager from './components/PluginsManager.jsx';
import HomeView from './components/HomeView.jsx';

const PLUGINS_VIEW = '__plugins__';
const HOME_VIEW = '__home__';

export default function App() {
  const toast = useToast();
  const t = useT();
  const [status, setStatus] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [activeId, setActiveId] = useState(null);
  // Tools that have been opened: kept mounted (just hidden) so switching tools in
  // the rail never loses a generated report / in-progress state.
  const [visited, setVisited] = useState(() => new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [railCollapsed, setRailCollapsed] = useState(() => { try { return localStorage.getItem('forge:rail-collapsed') === '1'; } catch { return false; } });

  const refreshStatus = useCallback(() => {
    return apiFetch('/api/config/status').then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  // (Re)load the plugin list; keep the active tool valid (enabled), else fall back.
  const loadPluginList = useCallback(() => {
    return apiFetch('/api/plugins').then((r) => r.json()).then((d) => {
      // Plugins can add, hide or reorder tools in the rail via this filter.
      const list = applyFilters('forge.plugins', d.plugins || []);
      setPlugins(list);
      setActiveId((cur) => {
        if (cur === PLUGINS_VIEW || cur === HOME_VIEW) return cur;
        const enabled = list.filter((p) => p.enabled !== false);
        if (cur && enabled.some((p) => p.id === cur)) return cur;
        // Default landing is the branded Home ("Start"), not the first tool.
        return HOME_VIEW;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // First ever launch lands on the branded Home; after that, straight into the
    // default tool (Home stays one click away in the rail). Flag is per-browser.
    let firstRun = false;
    try { firstRun = !localStorage.getItem('forge:home-seen'); if (firstRun) localStorage.setItem('forge:home-seen', '1'); } catch { /* storage blocked */ }
    if (firstRun) setActiveId(HOME_VIEW);
    loadPluginList();
    refreshStatus();
  }, [loadPluginList, refreshStatus]);

  const installing = shouldRunInstaller(status, isReadOnly());
  useEffect(() => { document.body.classList.toggle('is-installing', !!installing); }, [installing]);

  const toggleRail = useCallback(() => setRailCollapsed((c) => { const n = !c; try { localStorage.setItem('forge:rail-collapsed', n ? '1' : '0'); } catch { /* blocked */ } return n; }), []);
  const openSettings = useCallback((tab = 'general') => { setSettingsTab(tab); setWizardOpen(true); }, []);
  const openSetup = useCallback(() => openSettings('connectors'), [openSettings]);

  // "Start": the branded landing (welcome + tool tiles).
  const goHome = useCallback(() => setActiveId(HOME_VIEW), []);

  // Let tools react when they become the active tool.
  useEffect(() => {
    if (activeId && activeId !== PLUGINS_VIEW && activeId !== HOME_VIEW) {
      doAction('forge.tool.open', activeId);
      if (REGISTRY[activeId]) setVisited((v) => (v.has(activeId) ? v : new Set(v).add(activeId)));
    }
  }, [activeId]);

  const inHome = activeId === HOME_VIEW;
  const inPlugins = activeId === PLUGINS_VIEW;
  const active = plugins.find((p) => p.id === activeId);
  const ActiveTool = activeId && !inPlugins ? REGISTRY[activeId] : null;
  const coreApi = { toast, openSetup, status, refreshStatus, hooks };

  return (
    <CoreContext.Provider value={coreApi}>
      {installing && <Installer status={status} onDone={refreshStatus} />}

      {/* Full-bleed: the app fills the window, header across the top, full-height
          sidebar flush left, content filling the rest. No max-width column. */}
      <Flex direction="column" h="100dvh" overflow="hidden" bg="ui.bg">
        <Header railCollapsed={railCollapsed} onToggleRail={toggleRail} onHome={goHome} />

        <Flex flex="1" minH="0" direction={{ base: 'column', lg: 'row' }} align="stretch">
          {/* Sidebar: a flush, full-height column (own surface + right divider) that
              frames the workspace. Collapse is driven from the header burger. */}
          <Box as="nav" aria-label={t('Navigation')} flex="none" bg="ui.surface" borderColor="ui.border"
            borderBottomWidth={{ base: '1px', lg: '0' }}
            position="relative" zIndex="1"
            boxShadow={{ base: 'none', lg: '5px 0 28px -22px rgba(15,19,31,.10)' }}
            w={{ base: 'full', lg: railCollapsed ? '4.25rem' : '13.5rem' }}
            transition="width .34s cubic-bezier(.34,1.5,.5,1)"
            overflowY="auto" overflowX="hidden" px={{ base: '3', lg: '3' }} py={{ base: '2', lg: '3' }}>
            <Rail plugins={plugins} activeId={activeId} inHome={inHome} inPlugins={inPlugins}
              collapsed={railCollapsed} onHome={goHome} onSelect={setActiveId}
              onPlugins={() => setActiveId(PLUGINS_VIEW)} onOpenSettings={() => openSettings('general')} />
          </Box>

          {/* Content: the gray canvas inside the column; scrolls on its own, footer pinned to the base. */}
          <Box as="main" flex="1" minW="0" overflowY="auto" display="flex" flexDirection="column" bg="ui.bg">
            <Box flex="1" w="full" px={{ base: '5', lg: '12' }} py={{ base: '6', lg: '12' }}>
              {!inHome && (
                <Box mb="6">
                  <Heading as="h1" fontWeight="700" color="ui.heading" letterSpacing="-.02em" mb="1.5"
                    fontSize={{ base: '1.375rem', lg: 'clamp(1.5rem, 1.28rem + 1.1vw, 1.75rem)' }}>
                    {inPlugins ? t('Plugins') : (active ? t(active.name) : t('Changelog'))}
                  </Heading>
                  <Text color="ui.muted" fontSize="0.9688rem" maxW="68ch" lineHeight="1.55">
                    {inPlugins ? t('Plugins installed on UnleashWP AI Forge. Add your own.') : (active ? t(active.description) : '')}
                  </Text>
                </Box>
              )}
              {inHome && <HomeView plugins={plugins} openTool={setActiveId} />}
              {inPlugins && <PluginsManager plugins={plugins} onOpen={setActiveId} onChanged={loadPluginList} />}
              {/* Every opened tool stays mounted; only the active one is shown, so
                  switching tools in the rail never discards a generated report. */}
              {[...visited].map((id) => {
                const Tool = REGISTRY[id];
                if (!Tool) return null;
                return <Box key={id} display={!inHome && !inPlugins && activeId === id ? 'block' : 'none'}><Tool /></Box>;
              })}
              {!inHome && !inPlugins && active && !ActiveTool && (
                // A community plugin loaded server-side (MCP/CLI) with no bundled browser UI.
                <Box borderWidth="1px" borderColor="ui.border" borderRadius="forge" bg="ui.surface" px="6" py="10" textAlign="center" maxW="36rem" mx="auto" mt="4">
                  <Heading as="h3" fontSize="1rem" fontWeight="700" color="ui.heading" mb="2">{t(active.name)}</Heading>
                  <Text fontSize="0.875rem" color="ui.muted" lineHeight="1.55">{t('This plugin works through your AI and the terminal. It has no browser screen. Use it from Claude Code, Claude Desktop or Codex.')}</Text>
                </Box>
              )}
            </Box>
            <Footer version={status && status.version} onCredits={() => openSettings('credits')} />
          </Box>
        </Flex>
      </Flex>

      <SetupWizard status={status} refreshStatus={refreshStatus} open={wizardOpen} initialTab={settingsTab} onClose={() => setWizardOpen(false)} />
    </CoreContext.Provider>
  );
}
