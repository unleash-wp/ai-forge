// Setup drawer: wires up the two shared credentials (GitHub token + wordpress.org
// cookie). Both are the user's own, stored locally (owner-only), sent only to
// GitHub / WordPress.org. Rendered as a right-side offcanvas Drawer, toggled open
// by the shell — Chakra handles the backdrop, focus trap and Escape-to-close.
import { useState } from 'react';
import { fetchJSON } from '../core.jsx';
import { currentBrowser, BROWSER_NAMES } from '../browser.js';
import { Button, TextInput, TextArea } from '../ui';
import { Box, Circle, CloseButton, Code, Drawer, Grid, Heading, HStack, Link, Portal, Stack, Text, chakra } from '@chakra-ui/react';

const msgColor = (k) => (k === 'good' ? 'ui.goodInk' : k === 'bad' ? 'ui.bad' : 'ui.muted');

export default function SetupWizard({ status, refreshStatus, open, onClose }) {
  const [ghToken, setGhToken] = useState('');
  const [cookieVal, setCookieVal] = useState('');
  const [ghMsg, setGhMsg] = useState({ text: '', kind: '' });
  const [ckMsg, setCkMsg] = useState({ text: '', kind: '' });
  const [editGh, setEditGh] = useState(false);
  const [editTrac, setEditTrac] = useState(false);

  const gh = status ? status.github : { set: false };
  const trac = status ? status.trac : { set: false };
  const browser = currentBrowser();

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
      setGhMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); setEditGh(false); refreshStatus();
    });
  }
  function disconnectGh() {
    fetchJSON('/api/github-token', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) setGhMsg({ text: data.error, kind: 'bad' }); else { setGhToken(''); refreshStatus(); }
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
      setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); setEditTrac(false); refreshStatus();
    });
  }
  function disconnectCookie() {
    fetchJSON('/api/cookie', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) setCkMsg({ text: data.error, kind: 'bad' }); else { setCookieVal(''); refreshStatus(); }
    });
  }
  function importCookie() {
    setCkMsg({ text: 'Importing from ' + browser + '… (approve any Keychain prompt)', kind: '' });
    fetchJSON('/api/cookie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browser }) })
      .then(({ data }) => { setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); refreshStatus(); })
      .catch(() => setCkMsg({ text: 'Import failed.', kind: 'bad' }));
  }

  const ghSrc = gh.source === 'gh' ? 'GitHub CLI (gh)' : (gh.source === 'env' ? 'GITHUB_TOKEN env' : 'saved token');
  const showGhSetup = !gh.set || editGh;
  const showTracSetup = !trac.set || editTrac;

  return (
    <Drawer.Root open={open} onOpenChange={(e) => { if (!e.open) onClose(); }} size="md" placement="end">
      <Portal>
        <Drawer.Backdrop bg="blackAlpha.500" />
        <Drawer.Positioner>
          <Drawer.Content bg="ui.surface" color="ui.text">
            <Drawer.Header borderBottomWidth="1px" borderColor="ui.border" px="8" pt="7" pb="4">
              <Drawer.Title fontSize="1.375rem" fontWeight="700" color="ui.heading" letterSpacing="-.01em">Setup</Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" position="absolute" top="5" right="5" color="ui.muted" _hover={{ color: 'navy', bg: 'ui.ghostHover' }} />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body px="8" py="6">
              <Text color="ui.muted" fontSize="0.875rem" mb="8" maxW="70ch">Two keys, both stored locally (owner-only file) and sent only to GitHub / WordPress.org. Each is your own. Nothing is shared. The same keys power <Code>uwp --deep</Code> on the CLI.</Text>
              <Stack gap="8">
                <Grid templateColumns="2.125rem 1fr" gap="4">
                  <Circle size="2.125rem" bg={gh.set ? 'ui.good' : 'navy'} color="white" fontWeight="700" fontSize="0.9375rem" boxShadow="sm">{gh.set ? '✓' : '1'}</Circle>
                  <Box>
                    <Heading as="h3" mt="1" mb="1" fontSize="1rem" fontWeight="700" color="ui.heading">GitHub <chakra.em fontStyle="normal" color="ui.muted" fontWeight="500" fontSize="0.8125rem">lifts the API limit from 60 to 5000 requests an hour</chakra.em></Heading>
                    {gh.set && (
                      <HStack gap="1.5" flexWrap="wrap" fontSize="0.875rem" color="ui.goodInk" fontWeight="500"><chakra.span>✓</chakra.span> Connected · {ghSrc} · 5000/h
                        {gh.source === 'file'
                          ? <chakra.button type="button" onClick={disconnectGh} bg="none" border="0" p="0" ml="1.5" color="ui.muted" fontWeight="500" fontSize="0.7813rem" textDecoration="underline" cursor="pointer" _hover={{ color: 'ui.bad' }}>Disconnect</chakra.button>
                          : <chakra.span ml="1.5" color="ui.muted" fontWeight="400" fontSize="0.7813rem">{gh.source === 'gh' ? 'auto-detected from the gh CLI' : 'set by env var'}</chakra.span>}
                      </HStack>
                    )}
                    {showGhSetup && (
                      <Box>
                        <Text mt="0" mb="3" fontSize="0.875rem" color="ui.muted" maxW="66ch">Works with <b>any</b> GitHub account. You do <b>not</b> need access to the WordPress org, and the token needs <b>no scopes</b>. It only reads public repos and raises your rate limit. Skip it and the tool still runs at 60 requests an hour.</Text>
                        <chakra.ol my="2" mb="3" ml="4.5" p="0" fontSize="0.8125rem" color="ui.muted"><chakra.li my="1">One click if the <Code>gh</Code> CLI is logged in (detected automatically), or <Link href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener" color="ui.primary" fontWeight="600">create a token</Link> (leave every scope unchecked) and paste it below.</chakra.li></chakra.ol>
                        <chakra.form onSubmit={(e) => e.preventDefault()} autoComplete="off" m="0"><TextInput type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} onPaste={() => setTimeout(saveGh, 30)} placeholder="ghp_… or github_pat_…" autoComplete="off" spellCheck="false" /></chakra.form>
                        <HStack gap="2" mt="3" flexWrap="wrap">
                          <Button variant="primary" size="sm" onClick={saveGh}>Save &amp; connect</Button>
                          <Button variant="ghost" size="sm" onClick={testGh}>Test</Button>
                          <Text as="span" fontSize="0.7813rem" color={msgColor(ghMsg.kind)}>{ghMsg.text}</Text>
                        </HStack>
                      </Box>
                    )}
                    {gh.set && gh.source !== 'env' && !editGh && (
                      <chakra.button type="button" onClick={() => setEditGh(true)} mt="2" fontSize="0.7813rem" color="ui.muted" bg="none" border="0" p="0" textDecoration="underline" cursor="pointer">{gh.source === 'gh' ? 'Use your own token instead' : 'Use a different token'}</chakra.button>
                    )}
                  </Box>
                </Grid>
                <Grid templateColumns="2.125rem 1fr" gap="4">
                  <Circle size="2.125rem" bg={trac.set ? 'ui.good' : 'navy'} color="white" fontWeight="700" fontSize="0.9375rem" boxShadow="sm">{trac.set ? '✓' : '2'}</Circle>
                  <Box>
                    <Heading as="h3" mt="1" mb="1" fontSize="1rem" fontWeight="700" color="ui.heading">WordPress.org <chakra.em fontStyle="normal" color="ui.muted" fontWeight="500" fontSize="0.8125rem">only needed for “deep” (full ticket descriptions)</chakra.em></Heading>
                    {trac.set && (
                      <HStack gap="1.5" flexWrap="wrap" fontSize="0.875rem" color="ui.goodInk" fontWeight="500"><chakra.span>✓</chakra.span> Cookie saved · {trac.source}
                        {trac.source === 'file'
                          ? <chakra.button type="button" onClick={disconnectCookie} bg="none" border="0" p="0" ml="1.5" color="ui.muted" fontWeight="500" fontSize="0.7813rem" textDecoration="underline" cursor="pointer" _hover={{ color: 'ui.bad' }}>Disconnect</chakra.button>
                          : <chakra.span ml="1.5" color="ui.muted" fontWeight="400" fontSize="0.7813rem">set by env var</chakra.span>}
                      </HStack>
                    )}
                    {showTracSetup && (
                      <Box>
                        <Text mt="0" mb="3" fontSize="0.875rem" color="ui.muted" maxW="66ch">A web page can't read this cookie for you (it's HttpOnly). Quickest is to import it straight from the browser you're logged into:</Text>
                        {browser && (
                          <Box mb="3">
                            <chakra.span display="block" fontSize="0.7813rem" fontWeight="600" color="ui.text" mb="2">Quick import <chakra.span fontWeight="400" color="ui.muted">(macOS)</chakra.span></chakra.span>
                            <HStack flexWrap="wrap" gap="2"><Button variant="ghost" size="sm" onClick={importCookie}>Import from {BROWSER_NAMES[browser]}</Button></HStack>
                          </Box>
                        )}
                        <chakra.details mb="3">
                          <chakra.summary fontSize="0.7813rem" color="ui.muted" cursor="pointer">Or paste it manually</chakra.summary>
                          <chakra.ol mt="2" ml="4.5" p="0" fontSize="0.8125rem" color="ui.muted">
                            <chakra.li my="1"><Link href="https://wordpress.org/" target="_blank" rel="noopener" color="ui.primary" fontWeight="600">Log in to wordpress.org</Link>.</chakra.li>
                            <chakra.li my="1">DevTools → Application → Cookies → <Code>wordpress.org</Code> → copy <Code>wporg_logged_in</Code> + <Code>wporg_sec</Code> as <Code>name=value; name=value</Code>.</chakra.li>
                          </chakra.ol>
                          <TextArea rows="3" value={cookieVal} onChange={(e) => setCookieVal(e.target.value)} onPaste={() => setTimeout(saveCookie, 30)} placeholder="wporg_logged_in=…; wporg_sec=…" />
                        </chakra.details>
                        <HStack gap="2" mt="3" flexWrap="wrap">
                          <Button variant="primary" size="sm" onClick={saveCookie}>Save &amp; connect</Button>
                          <Button variant="ghost" size="sm" onClick={testCookie}>Test</Button>
                          <Text as="span" fontSize="0.7813rem" color={msgColor(ckMsg.kind)}>{ckMsg.text}</Text>
                        </HStack>
                      </Box>
                    )}
                    {trac.set && trac.source === 'file' && !editTrac && (
                      <chakra.button type="button" onClick={() => setEditTrac(true)} mt="2" fontSize="0.7813rem" color="ui.muted" bg="none" border="0" p="0" textDecoration="underline" cursor="pointer">Replace the cookie</chakra.button>
                    )}
                  </Box>
                </Grid>
              </Stack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
