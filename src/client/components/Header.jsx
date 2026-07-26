// The white brand bar: UnleashWP wordmark + "Forge", a dark-mode toggle and a
// Settings button that opens the settings panel.
import { useTheme } from 'next-themes';
import { Box, Flex, HStack, Link, Separator, chakra } from '@chakra-ui/react';
import { LOGO_FULL, LOGO_WHITE } from '../brand.js';
import { BurgerIcon } from '../icons.jsx';
import { useT } from '../i18n.jsx';
import NotificationBell from './NotificationBell.jsx';

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

const iconBtn = {
  type: 'button', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
  w: '2.25rem', h: '2.25rem', border: '0', bg: 'transparent', borderRadius: 'forge', color: 'ui.muted', cursor: 'pointer',
  transition: 'color .15s ease, background .15s ease', _hover: { color: 'ui.heading', bg: 'ui.ghostHover' },
};

export default function Header({ railCollapsed, onToggleRail, onHome }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const t = useT();
  return (
    <Box as="header" flex="none" bg="ui.surface" borderBottom="1px solid" borderColor="ui.border">
      {/* One left cluster: burger + wordmark together (no gap-void). The burger is
          left-padded to roughly the nav-icon axis so it still reads above the menu. */}
      <Flex py="3.5" align="center" gap="3.5" pl={{ base: '4', lg: '4' }} pr={{ base: '4', lg: '6' }}>
        <chakra.button {...iconBtn} hideBelow="lg" onClick={onToggleRail}
          aria-label={railCollapsed ? t('Expand menu') : t('Collapse menu')} title={railCollapsed ? t('Expand menu') : t('Collapse menu')}
          css={{ '& svg': { display: 'block' } }}><BurgerIcon size={19} /></chakra.button>
        <Link href="/" onClick={(e) => { e.preventDefault(); onHome(); }} aria-label={t('Go to start')} flex="none"
          display="inline-flex" alignItems="center" transition="opacity .15s" _hover={{ opacity: 0.78 }}>
          <Box _dark={{ display: 'none' }} css={{ '& svg': { height: '1.75rem', width: 'auto', display: 'block' } }} dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
          <Box display="none" _dark={{ display: 'block' }} css={{ '& svg': { height: '1.75rem', width: 'auto', display: 'block' } }} dangerouslySetInnerHTML={{ __html: LOGO_WHITE }} />
        </Link>
        <Separator orientation="vertical" h="1.25rem" borderColor="ui.border" hideBelow="sm" />
        <Link href="/" onClick={(e) => { e.preventDefault(); onHome(); }}
          color="ui.heading" fontWeight="500" fontSize="0.9688rem" hideBelow="sm" _hover={{ opacity: 0.7 }}>AI Forge</Link>
        <HStack ml="auto" gap="1">
          <NotificationBell />
          <chakra.button {...iconBtn} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={t('Toggle dark mode')} title={dark ? t('Light mode') : t('Dark mode')}
            css={{ '& svg': { width: '1.1875rem', height: '1.1875rem' } }} dangerouslySetInnerHTML={{ __html: dark ? SUN : MOON }} />
        </HStack>
      </Flex>
    </Box>
  );
}
