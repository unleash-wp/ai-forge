// Settings panel: a centered Dialog with a vertical tab sidebar (General,
// Connectors, Updates, Credits). Connectors are the user's own keys (GitHub
// token + wordpress.org cookie), stored locally (owner-only), sent only to
// GitHub / WordPress.org. Chakra handles backdrop, focus trap and Escape.
import { useState, useEffect } from 'react';
import { fetchJSON, useCore } from '../core.jsx';
import { currentBrowser, BROWSER_NAMES } from '../browser.js';
import { LOGO_FULL } from '../brand.js';
import { Button, TextInput, Select } from '../ui';
import { Box, CloseButton, Dialog, Flex, Heading, HStack, Link, Portal, Spinner, Stack, Tabs, Text, chakra } from '@chakra-ui/react';

const msgColor = (k) => (k === 'good' ? 'ui.goodInk' : k === 'bad' ? 'ui.bad' : 'ui.muted');
const REPO_URL = 'https://github.com/unleash-wp/wp-release-helper';

// Brand marks (currentColor, 24-grid) inlined so the CLI bundle stays self-contained.
const ICON_GITHUB = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.69.83.58C20.56 22.3 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z"/></svg>';
const ICON_WORDPRESS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.14-.009-1.065 0-1.82.93-1.82 1.926 0 .893.516 1.65 1.065 2.545.412.72.895 1.65.895 2.984 0 .93-.354 2.01-.825 3.51l-1.08 3.605-3.915-11.64.001.014M12 22.784c-1.059 0-2.081-.153-3.048-.437l3.24-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.32.607-3.585.607M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.98 1.212 16.283 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>';
// Claude Code + Codex: official marks (Claude Code keeps its brand colour).
const ICON_CLAUDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path clip-rule="evenodd" fill-rule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"/></svg>';
const ICON_CODEX = '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path clip-rule="evenodd" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z"/></svg>';
// Nav + action marks (currentColor, stroke).
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
const ICON_UNLINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>';
const ICON_PLUG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>';
const ICON_SLIDERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

// Copyable one-liner an assistant (Claude Code / Codex, running in this repo)
// can run to drive Forge from the CLI.
const FORGE_CMD = 'node bin/wp-release-helper.mjs --since <start> --until <end> --milestone <x.y> --post';

// Flag emoji from a 2-letter country code (regional indicator letters).
const flagOf = (cc) => cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

const LANGUAGES = [
  { value: 'en', label: flagOf('GB') + '  English' },
  { value: 'de', label: flagOf('DE') + '  Deutsch' },
];

// Current UTC offset for a zone, e.g. "+01:00" (empty-safe).
function utcOffset(zone) {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const off = name.replace('GMT', '');
    return off || '+00:00';
  } catch { return '+00:00'; }
}
const TZ_ZONES = (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function')
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC'];
const TIMEZONES = TZ_ZONES
  .map((z) => ({ value: z, off: utcOffset(z) }))
  .sort((a, b) => (a.off === b.off ? a.value.localeCompare(b.value) : a.off.localeCompare(b.off)))
  .map(({ value, off }) => ({ value, label: '(UTC' + off + ') ' + value }));
function browserTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

// Actual libraries in the browser bundle (package.json devDependencies).
const STACK = [
  { name: 'React', url: 'https://react.dev' },
  { name: 'Chakra UI', url: 'https://chakra-ui.com' },
  { name: 'Emotion', url: 'https://emotion.sh' },
  { name: 'next-themes', url: 'https://github.com/pacocoursey/next-themes' },
  { name: 'Remix Icon', url: 'https://remixicon.com' },
  { name: 'webpack', url: 'https://webpack.js.org' },
  { name: 'Babel', url: 'https://babeljs.io' },
  { name: 'Node.js', url: 'https://nodejs.org' },
];
// Where the data comes from (not build dependencies).
const DATA = [
  { name: 'GitHub REST API', url: 'https://docs.github.com/rest' },
  { name: 'WordPress.org Trac', url: 'https://core.trac.wordpress.org' },
  { name: 'mcp-context-wporg by Automattic', url: 'https://github.com/Automattic/mcp-context-wporg' },
];

function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}
const ghSourceLabel = (s) => (s === 'gh' ? 'GitHub CLI' : s === 'env' ? 'an environment variable' : 'a saved token');

// Clipboard write with a legacy fallback for contexts where the async Clipboard
// API is blocked (non-secure origin, older browsers).
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

function Glyph({ svg, size = '1.0625rem', ...rest }) {
  return <Box as="span" display="inline-flex" flex="none" css={{ '& svg': { width: size, height: size } }} dangerouslySetInnerHTML={{ __html: svg }} {...rest} />;
}

// Primary/ghost button that shows a spinner while its action runs.
function BusyBtn({ busy, variant = 'primary', children, ...rest }) {
  return (
    <Button variant={variant} size="sm" py="1.5" fontSize="0.8125rem" disabled={busy} {...rest}>
      <HStack gap="2">{busy ? <Spinner size="xs" borderWidth="1.5px" /> : null}<chakra.span>{children}</chakra.span></HStack>
    </Button>
  );
}
function DisconnectBtn({ onClick }) {
  return (
    <Button variant="ghost" size="sm" py="1.5" fontSize="0.8125rem" onClick={onClick} color="ui.bad" borderColor="ui.bad" _hover={{ bg: 'rgba(192,57,43,.08)', borderColor: 'ui.bad', color: 'ui.bad' }}>
      <HStack gap="1.5"><Glyph svg={ICON_UNLINK} size="0.875rem" /><chakra.span>Disconnect</chakra.span></HStack>
    </Button>
  );
}

function TabItem({ value, icon, label }) {
  return (
    <Tabs.Trigger value={value} justifyContent="flex-start" gap="2.5" fontWeight="600" borderRadius="sm" px="3" py="2" color="ui.text" transition="none" _selected={{ bg: 'navy', color: 'white', boxShadow: 'sm' }}>
      <Glyph svg={icon} />
      {label}
    </Tabs.Trigger>
  );
}
function TabTitle({ children }) {
  return <Heading as="h2" fontSize="1.125rem" fontWeight="700" color="ui.heading" mb="1.5">{children}</Heading>;
}
function TabIntro({ children }) {
  return <Text color="ui.muted" fontSize="0.8125rem" mb="5" maxW="60ch" lineHeight="1.5">{children}</Text>;
}

function ConnectorIcon({ svg }) {
  return (
    <Box flex="none" w="2.25rem" h="2.25rem" display="grid" placeItems="center" borderRadius="sm" bg="ui.sunk" color="ui.heading"
      css={{ '& svg': { width: '1.25rem', height: '1.25rem' } }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
function ConnectedTag() {
  return (
    <HStack gap="1.5" flex="none" color="ui.goodInk" fontSize="0.75rem" fontWeight="600">
      <Box w="0.4375rem" h="0.4375rem" borderRadius="full" bg="ui.good" flex="none" />
      <chakra.span>Connected</chakra.span>
    </HStack>
  );
}

// A connector is an accordion: the whole header row toggles the panel, so you
// never have to hit a small icon.
function ConnectorCard({ icon, name, desc, connected, required, open, onToggle, children }) {
  return (
    <Box borderWidth="1px" borderColor="ui.border" borderRadius="forge" bg="ui.surface" overflow="hidden">
      <Flex as="button" type="button" onClick={onToggle} align="center" gap="3" w="full" textAlign="left" bg="transparent" border="0" px="4" py="3.5" cursor="pointer" transition="background .12s" _hover={{ bg: 'ui.sunk' }}>
        <ConnectorIcon svg={icon} />
        <Box flex="1" minW="0">
          <HStack gap="2" flexWrap="wrap">
            <chakra.span fontWeight="700" fontSize="0.9375rem" color="ui.heading">{name}</chakra.span>
            {required ? <chakra.span flex="none" fontSize="0.6875rem" fontWeight="600" color="ui.muted">Required</chakra.span> : null}
            {connected ? <ConnectedTag /> : null}
          </HStack>
          {desc ? <chakra.span display="block" mt="0.5" fontSize="0.75rem" color="ui.muted" lineHeight="1.35">{desc}</chakra.span> : null}
        </Box>
        <Glyph svg={ICON_CHEVRON} color="ui.muted" transform={open ? 'rotate(180deg)' : undefined} transition="transform .15s" />
      </Flex>
      {open ? <Box px="4" pb="4" pt="4" borderTopWidth="1px" borderColor="ui.border">{children}</Box> : null}
    </Box>
  );
}

function CmdPanel({ id, copiedId, onCopy }) {
  return (
    <Stack gap="3">
      <chakra.code display="block" bg="ui.sunk" borderWidth="1px" borderColor="ui.border" borderRadius="sm" px="3" py="2.5" fontSize="0.75rem" color="ui.text" fontFamily="mono" overflowX="auto" whiteSpace="nowrap">{FORGE_CMD}</chakra.code>
      <Button variant="ghost" size="sm" py="1.5" fontSize="0.8125rem" onClick={onCopy} alignSelf="flex-start">{copiedId === id ? 'Copied' : 'Copy command'}</Button>
    </Stack>
  );
}

export default function SetupWizard({ status, refreshStatus, open, onClose }) {
  const [ghToken, setGhToken] = useState('');
  const [cookieVal, setCookieVal] = useState('');
  const [ghMsg, setGhMsg] = useState({ text: '', kind: '' });
  const [ckMsg, setCkMsg] = useState({ text: '', kind: '' });

  const core = useCore();
  const [copiedId, setCopiedId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState('');

  // General
  const [lang, setLang] = useState(() => readPref('forge:lang', 'en'));
  const [tz, setTz] = useState(() => readPref('forge:tz', browserTz()));

  // Updates
  const [updates, setUpdates] = useState([]);
  const [checking, setChecking] = useState(false);

  const gh = status ? status.github : { set: false };
  const trac = status ? status.trac : { set: false };
  const version = (status && status.version) || '';
  const browser = currentBrowser();
  const toggle = (id) => setOpenId((o) => (o === id ? null : id));

  function checkUpdatesNow() {
    setChecking(true);
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {}).finally(() => setChecking(false));
  }
  useEffect(() => { if (open) checkUpdatesNow(); }, [open]);

  function pickLang(v) { setLang(v); writePref('forge:lang', v); }
  function pickTz(v) { setTz(v); writePref('forge:tz', v); }

  function copyCmd(id) {
    copyText(FORGE_CMD)
      .then(() => { setCopiedId(id); core.toast('Command copied'); setTimeout(() => setCopiedId(null), 1600); })
      .catch(() => core.toast('Copy failed'));
  }

  function testGh() {
    setGhMsg({ text: 'Checking…', kind: '' });
    return fetchJSON('/api/github-token/test', { method: 'POST' }).then(({ data }) => {
      setGhMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); return refreshStatus();
    });
  }
  function saveGh() {
    const token = ghToken.trim();
    if (!token) { setGhMsg({ text: 'Paste a token first.', kind: 'bad' }); return; }
    setBusy('gh-token'); setGhMsg({ text: '', kind: '' });
    fetchJSON('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(({ ok, data }) => { if (ok) { setGhToken(''); return testGh(); } setGhMsg({ text: data.error, kind: 'bad' }); })
      .finally(() => setBusy(''));
  }
  function connectGh() {
    setBusy('gh-cli');
    fetchJSON('/api/github-token/enable', { method: 'POST' })
      .then(({ data }) => { if (data && data.error) core.toast(data.error); return refreshStatus(); })
      .finally(() => setBusy(''));
  }
  function disconnectGh() {
    fetchJSON('/api/github-token', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) core.toast(data.error); else { setGhToken(''); setGhMsg({ text: '', kind: '' }); refreshStatus(); }
    });
  }
  function testCookie() {
    setCkMsg({ text: 'Checking…', kind: '' });
    return fetchJSON('/api/cookie/test', { method: 'POST' }).then(({ data }) => {
      setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); return refreshStatus();
    });
  }
  function saveCookie() {
    const c = cookieVal.trim();
    if (!c) { setCkMsg({ text: 'Paste the cookie first.', kind: 'bad' }); return; }
    setBusy('wp-cookie'); setCkMsg({ text: '', kind: '' });
    fetchJSON('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: c }) })
      .then(({ ok, data }) => { if (ok) { setCookieVal(''); return testCookie(); } setCkMsg({ text: data.error, kind: 'bad' }); })
      .finally(() => setBusy(''));
  }
  function disconnectCookie() {
    fetchJSON('/api/cookie', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) setCkMsg({ text: data.error, kind: 'bad' }); else { setCookieVal(''); refreshStatus(); }
    });
  }
  function importCookie() {
    setBusy('wp-import'); setCkMsg({ text: '', kind: '' });
    fetchJSON('/api/cookie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browser }) })
      .then(({ data }) => { setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); return refreshStatus(); })
      .catch(() => setCkMsg({ text: 'Import failed.', kind: 'bad' }))
      .finally(() => setBusy(''));
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
                  <TabItem value="general" icon={ICON_SLIDERS} label="General" />
                  <TabItem value="connectors" icon={ICON_PLUG} label="Connectors" />
                  <TabItem value="updates" icon={ICON_DOWNLOAD} label="Updates" />
                  <TabItem value="credits" icon={ICON_INFO} label="Credits" />
                </Tabs.List>

                <Box flex="1" minW="0" overflowY="auto" px="6" py="6">

                  <Tabs.Content value="general" mt="0">
                    <TabTitle>General</TabTitle>
                    <TabIntro>Your settings for this browser. Saved on this device.</TabIntro>
                    <Stack gap="5" maxW="26rem">
                      <Box>
                        <chakra.label display="block" fontSize="0.8125rem" fontWeight="600" color="ui.text" mb="1.5">Language</chakra.label>
                        <Select block ariaLabel="Language" value={lang} onChange={pickLang} options={LANGUAGES} />
                      </Box>
                      <Box>
                        <chakra.label display="block" fontSize="0.8125rem" fontWeight="600" color="ui.text" mb="1.5">Timezone</chakra.label>
                        <Select block searchable ariaLabel="Timezone" value={tz} onChange={pickTz} options={TIMEZONES} placeholder="Pick a timezone" />
                        <Text fontSize="0.75rem" color="ui.muted" mt="1.5">Used to format dates.</Text>
                      </Box>
                    </Stack>
                  </Tabs.Content>

                  <Tabs.Content value="connectors" mt="0">
                    <TabTitle>Connectors</TabTitle>
                    <TabIntro>Tools get their data from these providers. GitHub and WordPress.org are needed for every tool. Claude Code and Codex just copy a command to run Forge.</TabIntro>
                    <Stack gap="3">

                      <ConnectorCard icon={ICON_GITHUB} name="GitHub" required desc="Raises the API limit to 5,000 requests per hour." connected={gh.set} open={openId === 'gh'} onToggle={() => toggle('gh')}>
                        {gh.set ? (
                          <HStack justify="space-between" gap="3" flexWrap="wrap">
                            <Text fontSize="0.8125rem" color="ui.muted">Connected with {ghSourceLabel(gh.source)}.</Text>
                            {gh.source !== 'env' && <DisconnectBtn onClick={disconnectGh} />}
                          </HStack>
                        ) : (
                          <Stack gap="3">
                            {gh.ghAvailable && <BusyBtn busy={busy === 'gh-cli'} onClick={connectGh} alignSelf="flex-start">Connect with GitHub CLI</BusyBtn>}
                            <chakra.form onSubmit={(e) => e.preventDefault()} autoComplete="off" m="0">
                              <HStack gap="2" align="center">
                                <Box flex="1"><TextInput type="password" size="sm" value={ghToken} onChange={(e) => setGhToken(e.target.value)} onPaste={() => setTimeout(saveGh, 30)} placeholder={gh.ghAvailable ? 'Or paste a token' : 'Paste a GitHub token'} autoComplete="off" spellCheck="false" /></Box>
                                <BusyBtn busy={busy === 'gh-token'} variant="ghost" onClick={saveGh} flex="none">Connect</BusyBtn>
                              </HStack>
                            </chakra.form>
                            <HStack justify="space-between" gap="3">
                              <Link href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener" fontSize="0.75rem" color="ui.primary" fontWeight="600">Create a token ↗</Link>
                              {ghMsg.text && <Text as="span" fontSize="0.75rem" color={msgColor(ghMsg.kind)}>{ghMsg.text}</Text>}
                            </HStack>
                          </Stack>
                        )}
                      </ConnectorCard>

                      <ConnectorCard icon={ICON_WORDPRESS} name="WordPress.org" required desc="Adds full ticket text for deep mode." connected={trac.set} open={openId === 'trac'} onToggle={() => toggle('trac')}>
                        {trac.set ? (
                          <HStack justify="space-between" gap="3" flexWrap="wrap">
                            <Text fontSize="0.8125rem" color="ui.muted">Cookie saved{trac.source === 'env' ? ' (environment variable)' : ''}.</Text>
                            {trac.source === 'file' && <DisconnectBtn onClick={disconnectCookie} />}
                          </HStack>
                        ) : (
                          <Stack gap="3">
                            {browser && <BusyBtn busy={busy === 'wp-import'} onClick={importCookie} alignSelf="flex-start">Import from {BROWSER_NAMES[browser]}</BusyBtn>}
                            <chakra.form onSubmit={(e) => e.preventDefault()} m="0">
                              <HStack gap="2" align="center">
                                <Box flex="1"><TextInput size="sm" value={cookieVal} onChange={(e) => setCookieVal(e.target.value)} onPaste={() => setTimeout(saveCookie, 30)} placeholder="Or paste wporg_logged_in=…; wporg_sec=…" spellCheck="false" /></Box>
                                <BusyBtn busy={busy === 'wp-cookie'} variant="ghost" onClick={saveCookie} flex="none">Connect</BusyBtn>
                              </HStack>
                            </chakra.form>
                            {ckMsg.text && <Text as="span" fontSize="0.75rem" color={msgColor(ckMsg.kind)}>{ckMsg.text}</Text>}
                          </Stack>
                        )}
                      </ConnectorCard>

                      <ConnectorCard icon={ICON_CLAUDE} name="Claude Code" desc="Run UnleashWP Forge from Claude Code." open={openId === 'claude'} onToggle={() => toggle('claude')}>
                        <CmdPanel id="claude" copiedId={copiedId} onCopy={() => copyCmd('claude')} />
                      </ConnectorCard>

                      <ConnectorCard icon={ICON_CODEX} name="Codex" desc="Run UnleashWP Forge from Codex." open={openId === 'codex'} onToggle={() => toggle('codex')}>
                        <CmdPanel id="codex" copiedId={copiedId} onCopy={() => copyCmd('codex')} />
                      </ConnectorCard>

                    </Stack>
                  </Tabs.Content>

                  <Tabs.Content value="updates" mt="0">
                    <TabTitle>Updates</TabTitle>
                    <TabIntro>Updates come from the public GitHub repo. Nothing installs on its own. You update with git when you want.</TabIntro>
                    <Box borderWidth="1px" borderColor="ui.border" borderRadius="forge" bg="ui.surface" p="4">
                      <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
                        <Box>
                          <chakra.span fontWeight="700" fontSize="0.9375rem" color="ui.heading">UnleashWP Forge</chakra.span>
                          <Text fontSize="0.8125rem" color="ui.muted">Version {version || '…'}</Text>
                        </Box>
                        <BusyBtn busy={checking} variant="ghost" onClick={checkUpdatesNow}>{checking ? 'Checking…' : 'Check for updates'}</BusyBtn>
                      </Flex>
                      {updates.length ? (
                        <Stack gap="2" mt="4" pt="4" borderTopWidth="1px" borderColor="ui.border">
                          {updates.map((u) => (
                            <HStack key={u.id} justify="space-between" gap="3" flexWrap="wrap">
                              <Text fontSize="0.8125rem" color="ui.text">{u.name}: {u.current} to <chakra.b color="ui.heading">{u.latest}</chakra.b></Text>
                              <Link href={u.url} target="_blank" rel="noopener" fontSize="0.75rem" color="ui.primary" fontWeight="600">Release notes ↗</Link>
                            </HStack>
                          ))}
                        </Stack>
                      ) : (
                        <HStack gap="2" mt="4" pt="4" borderTopWidth="1px" borderColor="ui.border" color="ui.goodInk" fontSize="0.8125rem" fontWeight="600">
                          <Box w="0.4375rem" h="0.4375rem" borderRadius="full" bg="ui.good" flex="none" />
                          <chakra.span>{checking ? 'Checking for updates…' : 'You have the latest version.'}</chakra.span>
                        </HStack>
                      )}
                    </Box>
                    <Text fontSize="0.75rem" color="ui.muted" mt="4" mb="1.5">Get the latest version:</Text>
                    <chakra.pre bg="ui.sunk" borderWidth="1px" borderColor="ui.border" borderRadius="sm" px="3" py="2.5" fontSize="0.75rem" color="ui.text" fontFamily="mono" overflowX="auto">git pull &amp;&amp; npm install</chakra.pre>
                    <Link href={REPO_URL + '/releases'} target="_blank" rel="noopener" display="inline-block" mt="3" fontSize="0.75rem" color="ui.primary" fontWeight="600">All releases ↗</Link>
                  </Tabs.Content>

                  <Tabs.Content value="credits" mt="0">
                    <TabTitle>Credits</TabTitle>
                    <Stack gap="6" maxW="46rem">
                      <Flex align="center" justify="space-between" gap="4" flexWrap="wrap" borderWidth="1px" borderColor="ui.border" borderRadius="forge" bg="ui.sunk" px="5" py="4">
                        <Link href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP" display="inline-flex" alignItems="center"
                          css={{ '& svg': { height: '1.5rem', width: 'auto', display: 'block', _dark: { filter: 'brightness(0) invert(1)' } } }} dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
                        <Box textAlign={{ base: 'left', sm: 'right' }}>
                          <chakra.span display="block" fontWeight="700" color="ui.heading" fontSize="0.9375rem">UnleashWP Forge</chakra.span>
                          <Text fontSize="0.8125rem" color="ui.muted">Version {version || '…'}</Text>
                        </Box>
                      </Flex>

                      <Text fontSize="0.8125rem" color="ui.muted" lineHeight="1.6">
                        An independent project by Benjamin Zekavica (Morvance). Not linked to the WordPress Foundation or Automattic Inc.{' '}
                        <Link href="https://unleash-wp.com" target="_blank" rel="noopener" color="ui.primary" fontWeight="600">unleash-wp.com ↗</Link>
                      </Text>

                      <Box>
                        <Heading as="h3" fontSize="0.9375rem" fontWeight="700" color="ui.heading" mb="2">Contributors</Heading>
                        <Text fontSize="0.8125rem" color="ui.text">Benjamin Zekavica, creator and maintainer.</Text>
                        <Text fontSize="0.8125rem" color="ui.muted" mt="1">Forge is open to everyone. <Link href={REPO_URL} target="_blank" rel="noopener" color="ui.primary" fontWeight="600">Contribute on GitHub ↗</Link></Text>
                      </Box>

                      <Box>
                        <Heading as="h3" fontSize="0.9375rem" fontWeight="700" color="ui.heading" mb="1">Built with</Heading>
                        <Text fontSize="0.8125rem" color="ui.muted" mb="2.5">Open-source libraries in the app:</Text>
                        <Stack gap="1.5">
                          {STACK.map((s) => (
                            <Link key={s.name} href={s.url} target="_blank" rel="noopener" fontSize="0.8125rem" color="ui.primary" fontWeight="600" w="fit-content">{s.name} ↗</Link>
                          ))}
                        </Stack>
                      </Box>

                      <Box>
                        <Heading as="h3" fontSize="0.9375rem" fontWeight="700" color="ui.heading" mb="1">Data sources</Heading>
                        <Text fontSize="0.8125rem" color="ui.muted" mb="2.5">Where the changelog data comes from:</Text>
                        <Stack gap="1.5">
                          {DATA.map((s) => (
                            <Link key={s.name} href={s.url} target="_blank" rel="noopener" fontSize="0.8125rem" color="ui.primary" fontWeight="600" w="fit-content">{s.name} ↗</Link>
                          ))}
                        </Stack>
                      </Box>

                      <Box borderTopWidth="1px" borderColor="ui.border" pt="5" pb="6">
                        <Heading as="h3" fontSize="0.9375rem" fontWeight="700" color="ui.heading" mb="3">Legal notice</Heading>
                        <Stack gap="3.5">
                          <LegalRow label="Provider">Morvance | Benjamin Zekavica<br />Charlottenstraße 14<br />52070 Aachen<br />Germany</LegalRow>
                          <LegalRow label="Contact"><Link href="mailto:support@unleash-wp.com" color="ui.primary" fontWeight="600">support@unleash-wp.com</Link></LegalRow>
                          <LegalRow label="VAT ID">DE 358 256 337<br /><chakra.span color="ui.muted" fontSize="0.75rem">VAT ID under § 27a German VAT Act.</chakra.span></LegalRow>
                        </Stack>
                      </Box>
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

function LegalRow({ label, children }) {
  return (
    <Flex gap="4" align="flex-start" direction={{ base: 'column', sm: 'row' }}>
      <chakra.span flex="none" w={{ base: 'auto', sm: '7rem' }} fontSize="0.75rem" fontWeight="700" textTransform="uppercase" letterSpacing="0.03em" color="ui.muted">{label}</chakra.span>
      <Box fontSize="0.8125rem" color="ui.text" lineHeight="1.55">{children}</Box>
    </Flex>
  );
}
