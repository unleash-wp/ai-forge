// One-click "Sign in with GitHub" via OAuth Device Flow. Starts the flow, shows
// the short user code + opens github.com, then polls until the server has
// exchanged and stored the token. The token never touches the client — this only
// sees a status. Calls onConnected() when done. Used by the first-run Installer
// and the Settings connector card, so the flow lives in one place.
import { useState, useRef, useEffect } from 'react';
import { Box, Code, HStack, Link, Text } from '@chakra-ui/react';
import { fetchJSON } from '../core.jsx';
import { useT } from '../i18n.jsx';
import { Button } from '../ui';

export default function GithubDeviceConnect({ onConnected }) {
  const t = useT();
  const [flow, setFlow] = useState(null); // { user_code, verification_uri }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const timer = useRef(null);
  const mounted = useRef(true);

  // Clear the pending timer AND stop the in-flight poll from re-scheduling or
  // calling setState after unmount (e.g. the Settings dialog closes mid-flow).
  useEffect(() => () => { mounted.current = false; clearTimeout(timer.current); }, []);

  function fail(text) { clearTimeout(timer.current); setBusy(false); setFlow(null); setMsg(text); }

  function poll(ms) {
    timer.current = setTimeout(() => {
      fetchJSON('/api/github-token/device/poll', { method: 'POST' }).then(({ data }) => {
        if (!mounted.current) return;
        if (data.status === 'connected') { setBusy(false); setFlow(null); setMsg(''); onConnected && onConnected(); return; }
        if (data.status === 'pending') { poll((data.interval || ms / 1000) * 1000); return; }
        fail(data.status === 'expired' ? t('The code expired — try again.')
          : data.status === 'denied' ? t('Access was denied.')
          : (data.message || t('Sign-in failed.')));
      }).catch(() => { if (mounted.current) fail(t('Sign-in failed.')); });
    }, ms);
  }

  function start() {
    // Open the popup synchronously inside the click (so the blocker allows it),
    // then point it at GitHub once the code is back. A sized popup keeps this app
    // — which shows the code — visible behind it. Falls back to a tab if blocked.
    const win = window.open('', 'forge-github-auth', 'popup,width=540,height=720');
    setBusy(true); setMsg('');
    fetchJSON('/api/github-token/device/start', { method: 'POST' }).then(({ data }) => {
      if (data.error) { if (win) win.close(); fail(data.error); return; }
      setFlow({ user_code: data.user_code, verification_uri: data.verification_uri });
      if (win) win.location.href = data.verification_uri;
      else try { window.open(data.verification_uri, '_blank', 'noopener'); } catch { /* the link below still works */ }
      poll((data.interval || 5) * 1000);
    }).catch(() => { if (win) win.close(); fail(t('Could not reach GitHub.')); });
  }

  if (flow) {
    return (
      <Box>
        <Text fontSize="0.8125rem" color="ui.muted" mb="2">{t('Enter this code on GitHub, then approve:')}</Text>
        <HStack gap="3" flexWrap="wrap" mb="2">
          <Code fontSize="1.0625rem" fontWeight="700" letterSpacing=".12em" px="2.5" py="1" borderRadius="sm">{flow.user_code}</Code>
          <Link href={flow.verification_uri} target="_blank" rel="noopener" color="ui.primary" fontWeight="600" fontSize="0.8125rem">{t('Open GitHub ↗')}</Link>
        </HStack>
        <Text fontSize="0.75rem" color="ui.muted">{t('Waiting for approval…')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Button variant="primary" size="sm" onClick={start} disabled={busy} alignSelf="flex-start">
        {busy ? t('Connecting…') : t('Sign in with GitHub')}
      </Button>
      {msg && <Text mt="1.5" fontSize="0.75rem" color="ui.bad">{msg}</Text>}
    </Box>
  );
}
