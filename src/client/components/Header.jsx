// The white brand bar: UnleashWP wordmark + "Forge", a dark-mode toggle and a
// Settings button that opens the settings panel.
import { useTheme } from 'next-themes';
import { Box, Flex, HStack, Link, Separator, chakra } from '@chakra-ui/react';
import { LOGO_FULL, LOGO_WHITE } from '../brand.js';
import { useT } from '../i18n.jsx';

const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

const iconBtn = {
  type: 'button', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
  w: '2.25rem', h: '2.25rem', border: '0', bg: 'transparent', borderRadius: 'forge', color: 'ui.muted', cursor: 'pointer',
  transition: 'color .15s ease, background .15s ease', _hover: { color: 'ui.heading', bg: 'ui.ghostHover' },
};

export default function Header({ headerRef, scrolled, onHome, onOpenSettings }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const t = useT();
  return (
    <Box as="header" ref={headerRef} position="sticky" top="0" zIndex="20" bg="ui.surface"
      borderBottom="1px solid" borderColor="ui.border" transition="box-shadow .18s ease"
      boxShadow={scrolled ? 'md' : 'none'}>
      <Flex maxW="72.5rem" mx="auto" px="6" py="3.5" align="center" gap="4">
        <Link href="/" onClick={(e) => { e.preventDefault(); onHome(); }} aria-label={t('Go to start')} flex="none"
          display="inline-flex" alignItems="center" transition="opacity .15s" _hover={{ opacity: 0.78 }}>
          <Box _dark={{ display: 'none' }} css={{ '& svg': { height: '1.75rem', width: 'auto', display: 'block' } }} dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
          <Box display="none" _dark={{ display: 'block' }} css={{ '& svg': { height: '1.75rem', width: 'auto', display: 'block' } }} dangerouslySetInnerHTML={{ __html: LOGO_WHITE }} />
        </Link>
        <Separator orientation="vertical" h="1.25rem" borderColor="ui.border" hideBelow="sm" />
        <Link href="/" onClick={(e) => { e.preventDefault(); onHome(); }}
          color="ui.heading" fontWeight="500" fontSize="0.9688rem" hideBelow="sm" _hover={{ opacity: 0.7 }}>AI Forge</Link>
        <HStack ml="auto" gap="1">
          <chakra.button {...iconBtn} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={t('Toggle dark mode')} title={dark ? t('Light mode') : t('Dark mode')}
            css={{ '& svg': { width: '1.1875rem', height: '1.1875rem' } }} dangerouslySetInnerHTML={{ __html: dark ? SUN : MOON }} />
          <chakra.button {...iconBtn} onClick={onOpenSettings} aria-label={t('Settings')} title={t('Settings')}
            css={{ '& svg': { width: '1.1875rem', height: '1.1875rem' } }} dangerouslySetInnerHTML={{ __html: GEAR }} />
        </HStack>
      </Flex>
    </Box>
  );
}
