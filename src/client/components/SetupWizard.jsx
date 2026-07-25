// Settings panel: a centered Dialog with a vertical tab sidebar (Connectors,
// room to grow). Connectors are the user's own keys — GitHub token +
// wordpress.org cookie — stored locally (owner-only), sent only to GitHub /
// WordPress.org. Chakra handles the backdrop, focus trap and Escape-to-close.
import { useState } from 'react';
import { fetchJSON, useCore } from '../core.jsx';
import { currentBrowser, BROWSER_NAMES } from '../browser.js';
import { Button, TextInput } from '../ui';
import { Box, CloseButton, Dialog, Flex, Heading, HStack, Link, Portal, Stack, Tabs, Text, chakra } from '@chakra-ui/react';

const msgColor = (k) => (k === 'good' ? 'ui.goodInk' : k === 'bad' ? 'ui.bad' : 'ui.muted');

// Brand marks (currentColor, 24-grid) inlined so the CLI bundle stays self-contained.
const ICON_GITHUB = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.69.83.58C20.56 22.3 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z"/></svg>';
const ICON_WORDPRESS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.14-.009-1.065 0-1.82.93-1.82 1.926 0 .893.516 1.65 1.065 2.545.412.72.895 1.65.895 2.984 0 .93-.354 2.01-.825 3.51l-1.08 3.605-3.915-11.64.001.014M12 22.784c-1.059 0-2.081-.153-3.048-.437l3.24-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.32.607-3.585.607M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.98 1.212 16.283 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>';
// Claude Code + Codex: official marks (Claude Code keeps its brand colour).
const ICON_CLAUDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path clip-rule="evenodd" fill-rule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"/></svg>';
const ICON_CODEX = '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path clip-rule="evenodd" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z"/></svg>';
// Action marks (currentColor, stroke): connect / disconnect / copy / done.
const ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const ICON_UNLINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>';
const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
// Gear — same mark as the header trigger, shown on the sidebar tab.
const ICON_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

// Copyable one-liner an assistant (Claude Code / Codex, running in this repo)
// can execute to drive Forge from the CLI — the zero-dep entry the skill uses.
const FORGE_CMD = 'node bin/wp-release-helper.mjs --since <start> --until <end> --milestone <x.y> --post';

// Clipboard write with a legacy fallback for contexts where the async Clipboard
// API is unavailable or blocked (non-secure origin, older browsers).
function copyText(text) {
  const legacy = () => new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    } catch (e) { reject(e); }
  });
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(legacy);
  }
  return legacy();
}

function ConnectorIcon({ svg }) {
  return (
    <Box flex="none" w="2.25rem" h="2.25rem" display="grid" placeItems="center" borderRadius="sm" bg="ui.sunk" color="ui.heading"
      css={{ '& svg': { width: '1.25rem', height: '1.25rem' } }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// Square icon-only action button (connect / disconnect / copy), consistent
// across every connector. `title` doubles as the accessible label.
function IconBtn({ svg, title, tone, onClick }) {
  const hoverColor = tone === 'danger' ? 'ui.bad' : (tone === 'good' ? 'ui.goodInk' : 'navy');
  return (
    <chakra.button type="button" onClick={onClick} aria-label={title} title={title}
      display="inline-flex" alignItems="center" justifyContent="center" flex="none" w="2.125rem" h="2.125rem"
      border="0" bg="transparent" borderRadius="sm" color={tone === 'good' ? 'ui.goodInk' : 'ui.muted'} cursor="pointer"
      transition="color .12s, background .12s" _hover={{ color: hoverColor, bg: 'ui.ghostHover' }}
      css={{ '& svg': { width: '1.125rem', height: '1.125rem' } }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// Small green "Connected" tag shown inline next to a provider's name.
function ConnectedTag() {
  return (
    <HStack gap="1.5" flex="none" color="ui.goodInk" fontSize="0.75rem" fontWeight="600">
      <Box w="0.4375rem" h="0.4375rem" borderRadius="full" bg="ui.good" flex="none" />
      <chakra.span>Connected</chakra.span>
    </HStack>
  );
}

function ConnectorCard({ icon, name, desc, connected, right, children }) {
  return (
    <Box borderWidth="1px" borderColor="ui.border" borderRadius="forge" bg="ui.surface" p="4">
      <Flex align="center" gap="3">
        <ConnectorIcon svg={icon} />
        <Box flex="1" minW="0">
          <HStack gap="2" flexWrap="wrap">
            <chakra.span fontWeight="700" fontSize="0.9375rem" color="ui.heading">{name}</chakra.span>
            {connected ? <ConnectedTag /> : null}
          </HStack>
          {desc ? <chakra.span display="block" mt="0.5" fontSize="0.75rem" color="ui.muted" lineHeight="1.35">{desc}</chakra.span> : null}
        </Box>
        {right ? <Box flex="none">{right}</Box> : null}
      </Flex>
      {children ? <Box mt="3">{children}</Box> : null}
    </Box>
  );
}

export default function SetupWizard({ status, refreshStatus, open, onClose }) {
  const [ghToken, setGhToken] = useState('');
  const [cookieVal, setCookieVal] = useState('');
  const [ghMsg, setGhMsg] = useState({ text: '', kind: '' });
  const [ckMsg, setCkMsg] = useState({ text: '', kind: '' });

  const core = useCore();
  const [copiedId, setCopiedId] = useState(null);
  const [openForm, setOpenForm] = useState(null);

  const gh = status ? status.github : { set: false };
  const trac = status ? status.trac : { set: false };
  const browser = currentBrowser();

  function copyCmd(id) {
    copyText(FORGE_CMD)
      .then(() => { setCopiedId(id); core.toast('Command copied'); setTimeout(() => setCopiedId(null), 1600); })
      .catch(() => core.toast('Copy failed'));
  }

  function saveGh() {
    const token = ghToken.trim();
    if (!token) { setGhMsg({ text: 'paste the token first', kind: 'bad' }); return; }
    setGhMsg({ text: 'saving…', kind: '' });
    fetchJSON('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(({ ok, data }) => { if (ok) { setGhToken(''); testGh(); } else setGhMsg({ text: data.error, kind: 'bad' }); });
  }
  function testGh() {
    setGhMsg({ text: 'testing…', kind: '' });
    fetchJSON('/api/github-token/test', { method: 'POST' }).then(({ data }) => {
      setGhMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); refreshStatus();
    });
  }
  function disconnectGh() {
    fetchJSON('/api/github-token', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) core.toast(data.error); else { setGhToken(''); setGhMsg({ text: '', kind: '' }); refreshStatus(); }
    });
  }
  function connectGh() {
    fetchJSON('/api/github-token/enable', { method: 'POST' }).then(({ data }) => {
      if (data && data.error) core.toast(data.error); else { setOpenForm(null); refreshStatus(); }
    });
  }
  function saveCookie() {
    const c = cookieVal.trim();
    if (!c) { setCkMsg({ text: 'paste the cookie first', kind: 'bad' }); return; }
    setCkMsg({ text: 'saving…', kind: '' });
    fetchJSON('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: c }) })
      .then(({ ok, data }) => { if (ok) { setCookieVal(''); testCookie(); } else setCkMsg({ text: data.error, kind: 'bad' }); });
  }
  function testCookie() {
    setCkMsg({ text: 'testing…', kind: '' });
    fetchJSON('/api/cookie/test', { method: 'POST' }).then(({ data }) => {
      setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); refreshStatus();
    });
  }
  function disconnectCookie() {
    fetchJSON('/api/cookie', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) setCkMsg({ text: data.error, kind: 'bad' }); else { setCookieVal(''); refreshStatus(); }
    });
  }
  function importCookie() {
    setCkMsg({ text: 'Importing from ' + browser + '…', kind: '' });
    fetchJSON('/api/cookie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browser }) })
      .then(({ data }) => { setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); refreshStatus(); })
      .catch(() => setCkMsg({ text: 'Import failed.', kind: 'bad' }));
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose(); }} size="xl" placement="center">
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.500" />
        <Dialog.Positioner p="4">
          <Dialog.Content bg="ui.surface" color="ui.text" maxW="64rem" w="full" h="min(90vh, 46rem)" borderRadius="forge" overflow="hidden" display="flex" flexDirection="column">
            <Dialog.Header borderBottomWidth="1px" borderColor="ui.border" px="6" py="4" flex="none">
              <Dialog.Title fontSize="1.25rem" fontWeight="700" color="ui.heading" letterSpacing="-.01em">Settings</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" position="absolute" top="3.5" right="4" color="ui.muted" _hover={{ color: 'navy', bg: 'ui.ghostHover' }} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body p="0" flex="1" minH="0" display="flex">
              <Tabs.Root orientation="vertical" defaultValue="connectors" variant="plain" display="flex" w="full" flex="1" minH="0">
                <Tabs.List flex="none" minW="12.5rem" bg="ui.sunk" borderRightWidth="1px" borderColor="ui.border" p="3" gap="0.5" display="flex" flexDirection="column" alignItems="stretch">
                  <Tabs.Trigger value="connectors" justifyContent="flex-start" gap="2" fontWeight="600" borderRadius="sm" px="3" py="2" color="ui.text" transition="none" _selected={{ bg: 'navy', color: 'white', boxShadow: 'sm' }}>
                    <Box as="span" display="inline-flex" flex="none" css={{ '& svg': { width: '1.0625rem', height: '1.0625rem' } }} dangerouslySetInnerHTML={{ __html: ICON_GEAR }} />
                    Connectors
                  </Tabs.Trigger>
                </Tabs.List>
                <Box flex="1" minW="0" overflowY="auto" px="6" py="6">
                  <Tabs.Content value="connectors" mt="0">
                    <Heading as="h2" fontSize="1.125rem" fontWeight="700" color="ui.heading" mb="5">Connectors</Heading>
                    <Stack gap="3">

                      <ConnectorCard
                        icon={ICON_GITHUB}
                        name="GitHub"
                        desc="Raises the API rate limit to 5,000 requests an hour."
                        connected={gh.set}
                        right={gh.set
                          ? <IconBtn svg={ICON_UNLINK} title="Disconnect" tone="danger" onClick={disconnectGh} />
                          : <IconBtn svg={ICON_LINK} title="Connect" onClick={() => setOpenForm((o) => (o === 'gh' ? null : 'gh'))} />}>
                        {!gh.set && openForm === 'gh' && (
                          <Stack gap="3" pt="4" mt="1" borderTopWidth="1px" borderColor="ui.border">
                            {gh.ghAvailable && <Button variant="primary" size="sm" py="1.5" fontSize="0.8125rem" onClick={connectGh} alignSelf="flex-start">Connect with GitHub CLI</Button>}
                            <chakra.form onSubmit={(e) => e.preventDefault()} autoComplete="off" m="0">
                              <HStack gap="2" align="center">
                                <Box flex="1"><TextInput type="password" size="sm" value={ghToken} onChange={(e) => setGhToken(e.target.value)} onPaste={() => setTimeout(saveGh, 30)} placeholder={gh.ghAvailable ? 'Or paste a token' : 'Paste a GitHub token'} autoComplete="off" spellCheck="false" /></Box>
                                <Button variant="ghost" size="sm" py="1.5" fontSize="0.8125rem" onClick={saveGh} flex="none">Connect</Button>
                              </HStack>
                            </chakra.form>
                            <HStack justify="space-between" gap="3">
                              <Link href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener" fontSize="0.75rem" color="ui.primary" fontWeight="600">Create a token ↗</Link>
                              {ghMsg.text && <Text as="span" fontSize="0.75rem" color={msgColor(ghMsg.kind)}>{ghMsg.text}</Text>}
                            </HStack>
                          </Stack>
                        )}
                      </ConnectorCard>

                      <ConnectorCard
                        icon={ICON_WORDPRESS}
                        name="WordPress.org"
                        desc="Adds full Trac ticket descriptions for deep mode."
                        connected={trac.set}
                        right={trac.set
                          ? (trac.source === 'file' ? <IconBtn svg={ICON_UNLINK} title="Disconnect" tone="danger" onClick={disconnectCookie} /> : null)
                          : <IconBtn svg={ICON_LINK} title="Connect" onClick={() => setOpenForm((o) => (o === 'trac' ? null : 'trac'))} />}>
                        {!trac.set && openForm === 'trac' && (
                          <Stack gap="3" pt="4" mt="1" borderTopWidth="1px" borderColor="ui.border">
                            {browser && <Button variant="primary" size="sm" py="1.5" fontSize="0.8125rem" onClick={importCookie} alignSelf="flex-start">Import from {BROWSER_NAMES[browser]}</Button>}
                            <chakra.form onSubmit={(e) => e.preventDefault()} m="0">
                              <HStack gap="2" align="center">
                                <Box flex="1"><TextInput size="sm" value={cookieVal} onChange={(e) => setCookieVal(e.target.value)} onPaste={() => setTimeout(saveCookie, 30)} placeholder="Or paste wporg_logged_in=…; wporg_sec=…" spellCheck="false" /></Box>
                                <Button variant="ghost" size="sm" py="1.5" fontSize="0.8125rem" onClick={saveCookie} flex="none">Connect</Button>
                              </HStack>
                            </chakra.form>
                            {ckMsg.text && <Text as="span" fontSize="0.75rem" color={msgColor(ckMsg.kind)}>{ckMsg.text}</Text>}
                          </Stack>
                        )}
                      </ConnectorCard>

                      <ConnectorCard icon={ICON_CLAUDE} name="Claude Code" desc="Copy the CLI command to run UnleashWP Forge from Claude Code." right={<IconBtn svg={copiedId === 'claude' ? ICON_CHECK : ICON_COPY} title={copiedId === 'claude' ? 'Copied' : 'Copy command'} tone={copiedId === 'claude' ? 'good' : undefined} onClick={() => copyCmd('claude')} />} />
                      <ConnectorCard icon={ICON_CODEX} name="Codex" desc="Copy the CLI command to run UnleashWP Forge from Codex." right={<IconBtn svg={copiedId === 'codex' ? ICON_CHECK : ICON_COPY} title={copiedId === 'codex' ? 'Copied' : 'Copy command'} tone={copiedId === 'codex' ? 'good' : undefined} onClick={() => copyCmd('codex')} />} />

                    </Stack>
                  </Tabs.Content>
                </Box>
              </Tabs.Root>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
