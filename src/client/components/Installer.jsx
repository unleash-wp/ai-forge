// First-run install wizard (blocking, 2 steps). Shown until /api/installed is set.
import { useState } from 'react';
import { fetchJSON } from '../core.jsx';
import { currentBrowser, BROWSER_NAMES } from '../browser.js';
import { LOGO_FULL } from '../brand.js';
import { useT } from '../i18n.jsx';
import { Button, TextInput, TextArea } from '../ui';
import { Box, Code, Flex, Heading, HStack, Link, Text, chakra } from '@chakra-ui/react';

const msgColor = (k) => (k === 'good' ? 'ui.goodInk' : k === 'bad' ? 'ui.bad' : 'ui.muted');
const linkBtn = { background: 'none', border: '0', color: 'ui.muted', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'body' };

export default function Installer({ status, onDone }) {
  const t = useT();
  const [step, setStep] = useState(1);
  const [gh, setGh] = useState('');
  const [cookie, setCookie] = useState('');
  const [ghMsg, setGhMsg] = useState({ text: '', kind: '' });
  const [ckMsg, setCkMsg] = useState({ text: '', kind: '' });
  const [escape, setEscape] = useState(false);

  const ghDetected = !!(status && status.github && status.github.set);
  const browser = currentBrowser();

  function finish() {
    fetch('/api/installed', { method: 'POST' }).then(() => onDone());
  }

  function primary() {
    if (step === 1) {
      const t = gh.trim();
      if (t) {
        setGhMsg({ text: t('saving…'), kind: '' });
        fetchJSON('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) })
          .then(({ data }) => {
            if (data && data.error) setGhMsg({ text: data.error, kind: 'bad' });
            else { setGh(''); setStep(2); }
          });
      } else { setStep(2); }
      return;
    }
    const c = cookie.trim();
    if (!c) { setCkMsg({ text: t('Paste your cookie to finish, or continue anyway below.'), kind: 'bad' }); setEscape(true); return; }
    setCkMsg({ text: t('saving and testing…'), kind: '' });
    fetchJSON('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: c }) })
      .then(({ ok, data }) => {
        if (!ok) { setCkMsg({ text: data.error || t('could not save'), kind: 'bad' }); setEscape(true); return; }
        return fetchJSON('/api/cookie/test', { method: 'POST' }).then(({ data: d }) => {
          if (d.ok) finish();
          else { setCkMsg({ text: d.message || t('Trac could not validate the cookie.'), kind: 'bad' }); setEscape(true); }
        });
      });
  }

  function importCookie() {
    setCkMsg({ text: t('Importing from %s… (approve any Keychain prompt)', browser), kind: '' });
    fetchJSON('/api/cookie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browser }) })
      .then(({ data }) => {
        if (data.saved) finish();
        else { setCkMsg({ text: data.message, kind: 'bad' }); setEscape(true); }
      })
      .catch(() => { setCkMsg({ text: t('Import failed.'), kind: 'bad' }); setEscape(true); });
  }

  return (
    <Flex position="fixed" inset="0" zIndex="200" bg="rgba(15,19,31,.55)" backdropFilter="blur(4px)" placeItems="center" p="6">
      <Box w="full" maxW="35rem" bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="lg" overflow="hidden">
        <Flex align="center" justify="space-between" gap="4" px="6" py="4" borderBottom="1px solid" borderColor="ui.border">
          <chakra.span aria-label="UnleashWP" css={{ '& svg': { height: '1.25rem', width: 'auto', display: 'block', _dark: { filter: 'brightness(0) invert(1)' } } }} dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
          <HStack gap="2">
            {[1, 2].map((n) => <Box key={n} w="0.5rem" h="0.5rem" borderRadius="full" transition="background .2s" bg={step >= n ? 'navy' : 'ui.border'} />)}
          </HStack>
        </Flex>
        <Box p="6">
          {step === 1 && (
            <Box>
              <Text fontSize="0.75rem" fontWeight="600" color="ui.muted">{t('Step 1 of 2')}</Text>
              <Heading as="h2" mt="0" mb="2" fontSize="1.1875rem" fontWeight="700" color="ui.heading" letterSpacing="-.01em">{t('Connect GitHub')}</Heading>
              <Text fontSize="0.875rem" color="ui.muted" mb="4" lineHeight="1.55">{t('Raises your API limit from 60 to 5000 requests an hour. Works with')} <b>{t('any')}</b> {t('GitHub account. No access to the WordPress org, no token scopes. It only reads public repos.')}</Text>
              {ghDetected ? (
                <HStack gap="2" color="ui.goodInk" fontWeight="500" fontSize="0.875rem" mb="3"><chakra.span>✓</chakra.span> {t('GitHub ready')} · {status.github.source === 'gh' ? t('detected from the gh CLI') : t('saved token')} · 5000/h</HStack>
              ) : (
                <Box>
                  <chakra.ol mb="3" ml="4.5" p="0" fontSize="0.8125rem" color="ui.muted"><chakra.li my="1">{t('Detected automatically if the')} <Code>gh</Code> {t('CLI is logged in, or')} <Link href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener" color="ui.primary" fontWeight="600">{t('create a token')}</Link> {t('(leave every scope unchecked) and paste it:')}</chakra.li></chakra.ol>
                  <chakra.form onSubmit={(e) => e.preventDefault()} autoComplete="off" m="0"><TextInput type="password" value={gh} onChange={(e) => setGh(e.target.value)} placeholder={t('ghp_… or github_pat_…  (optional, skip for 60/h)')} autoComplete="off" spellCheck="false" /></chakra.form>
                  <Text as="span" fontSize="0.7813rem" color={msgColor(ghMsg.kind)}>{ghMsg.text}</Text>
                </Box>
              )}
            </Box>
          )}
          {step === 2 && (
            <Box>
              <Text fontSize="0.75rem" fontWeight="600" color="ui.muted">{t('Step 2 of 2')}</Text>
              <Heading as="h2" mt="0" mb="2" fontSize="1.1875rem" fontWeight="700" color="ui.heading" letterSpacing="-.01em">{t('Connect WordPress.org')}</Heading>
              <Text fontSize="0.875rem" color="ui.muted" mb="4" lineHeight="1.55">{t('Needed for')} <b>{t('deep')}</b>{t(': full Trac ticket descriptions. Paste your session cookie once; it is stored locally (owner-only) and sent only to WordPress.org.')}</Text>
              {browser && (
                <Box mb="3">
                  <chakra.span display="block" fontSize="0.7813rem" fontWeight="600" color="ui.text" mb="2">{t('Quick import from your browser')} <chakra.span fontWeight="400" color="ui.muted">{t('(you must be logged in there)')}</chakra.span></chakra.span>
                  <HStack flexWrap="wrap" gap="2"><Button variant="ghost" size="sm" onClick={importCookie}>{t('Import from %s', BROWSER_NAMES[browser])}</Button></HStack>
                </Box>
              )}
              <chakra.details mb="3">
                <chakra.summary fontSize="0.7813rem" color="ui.muted" cursor="pointer">{t('Or paste it manually')}</chakra.summary>
                <chakra.ol mt="2" ml="4.5" p="0" fontSize="0.8125rem" color="ui.muted">
                  <chakra.li my="1"><Link href="https://wordpress.org/" target="_blank" rel="noopener" color="ui.primary" fontWeight="600">{t('Log in to wordpress.org')}</Link>.</chakra.li>
                  <chakra.li my="1">{t('DevTools → Application → Cookies →')} <Code>wordpress.org</Code> {t('→ copy')} <Code>wporg_logged_in</Code> + <Code>wporg_sec</Code> {t('as')} <Code>name=value; name=value</Code>.</chakra.li>
                </chakra.ol>
                <TextArea rows="3" value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="wporg_logged_in=…; wporg_sec=…" />
              </chakra.details>
              <Text as="span" fontSize="0.7813rem" color={msgColor(ckMsg.kind)}>{ckMsg.text}</Text>
              {escape && (
                <Box mt="4" pt="4" borderTop="1px solid" borderColor="ui.border" fontSize="0.8125rem" color="ui.muted">{t("Trac isn't reachable right now (bot wall or expired cookie). You can")} <chakra.button type="button" onClick={finish} css={linkBtn}>{t('continue anyway')}</chakra.button>{t('. The tool runs cookie-free and you can add the cookie later in Setup.')}</Box>
              )}
            </Box>
          )}
        </Box>
        <Flex align="center" gap="3" px="6" py="4" borderTop="1px solid" borderColor="ui.border">
          {step !== 1 && <chakra.button type="button" onClick={() => setStep(1)} css={linkBtn}>{t('Back')}</chakra.button>}
          <Box ml="auto"><Button variant="primary" onClick={primary}>{step === 1 ? t('Continue') : t('Finish setup')}</Button></Box>
        </Flex>
      </Box>
    </Flex>
  );
}
