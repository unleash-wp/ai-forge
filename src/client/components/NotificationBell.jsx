// Header notification center: a bell with a dot when a tool has an update, and a
// dropdown listing them. Replaces the old full-width update bar. Self-contained.
// It fetches /api/updates itself; the Updates tab in Settings stays the full view.
import { useState, useEffect, useRef } from 'react';
import { Box, Link, Stack, Text, chakra } from '@chakra-ui/react';
import { apiFetch } from '../core.jsx';
import { useT } from '../i18n.jsx';

const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

const iconBtn = {
  type: 'button', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
  w: '2.25rem', h: '2.25rem', border: '0', bg: 'transparent', borderRadius: 'forge', color: 'ui.muted', cursor: 'pointer',
  transition: 'color .15s ease, background .15s ease', _hover: { color: 'ui.heading', bg: 'ui.ghostHover' },
};

export default function NotificationBell() {
  const t = useT();
  const [updates, setUpdates] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    apiFetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  const n = updates.length;

  return (
    <Box position="relative" ref={ref}>
      <chakra.button {...iconBtn} onClick={() => setOpen((o) => !o)} aria-label={t('Notifications')} title={t('Notifications')} aria-expanded={open} _active={{ transform: 'scale(0.92)' }}>
        <Box css={{ '& svg': { width: '1.1875rem', height: '1.1875rem' } }} dangerouslySetInnerHTML={{ __html: BELL }} />
        {n > 0 && (
          <Box position="absolute" top="0.0625rem" right="0.0625rem" minW="1.15rem" h="1.15rem" px="1"
            display="grid" placeItems="center" borderRadius="full" bg="ui.bad" color="white"
            fontSize="0.6875rem" fontWeight="800" lineHeight="1" borderWidth="2px" borderColor="ui.surface"
            css={{ animation: 'forgeBadge .2s cubic-bezier(.22,1,.36,1)', '@keyframes forgeBadge': { from: { transform: 'scale(0)', opacity: 0 }, to: { transform: 'scale(1)', opacity: 1 } } }}>
            {n > 9 ? '9+' : n}
          </Box>
        )}
      </chakra.button>

      {open && (
        <Box position="absolute" right="0" mt="2" w="20rem" maxW="calc(100vw - 2rem)" zIndex="50"
          bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="forge" boxShadow="lg" p="3"
          role="dialog" aria-label={t('Notifications')}>
          <Text fontSize="0.6875rem" fontWeight="700" textTransform="uppercase" letterSpacing=".06em" color="ui.muted" mb="1.5" px="1">{t('Notifications')}</Text>
          {n === 0 ? (
            <Text fontSize="0.8125rem" color="ui.muted" px="1" py="2">{t('You have the latest version.')}</Text>
          ) : (
            <Stack gap="0">
              {updates.map((u) => (
                <Box key={u.id} px="1" py="2.5" borderTopWidth="1px" borderColor="ui.border" _first={{ borderTopWidth: '0' }}>
                  <Text fontSize="0.8125rem" color="ui.text">{u.name}: {u.current} → <chakra.b color="ui.heading">{u.latest}</chakra.b></Text>
                  <Link href={u.url} target="_blank" rel="noopener" fontSize="0.75rem" color="ui.primary" fontWeight="600">{t('Release notes ↗')}</Link>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}
