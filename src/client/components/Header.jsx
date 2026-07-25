// The white brand bar: UnleashWP wordmark + "Forge" + a Settings button that
// opens the settings panel (keys today, UnleashWP account soon).
import { Box, Flex, Link, Separator, chakra } from '@chakra-ui/react';
import { LOGO_FULL } from '../brand.js';

function GearIcon() {
  return (
    <Box as="span" display="inline-flex" flex="none" css={{ '& svg': { width: '1.1875rem', height: '1.1875rem' } }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Box>
  );
}

export default function Header({ headerRef, scrolled, onOpenSettings }) {
  return (
    <Box as="header" ref={headerRef} position="sticky" top="0" zIndex="20" bg="ui.surface"
      borderBottom="1px solid" borderColor="ui.border" transition="box-shadow .18s ease"
      boxShadow={scrolled ? 'md' : 'none'}>
      <Flex maxW="72.5rem" mx="auto" px="6" py="3.5" align="center" gap="4">
        <Link href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP" flex="none"
          display="inline-flex" alignItems="center" transition="opacity .15s" _hover={{ opacity: 0.78 }}
          css={{ '& svg': { height: '1.75rem', width: 'auto', display: 'block', _dark: { filter: 'brightness(0) invert(1)' } } }}
          dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
        <Separator orientation="vertical" h="1.25rem" borderColor="ui.border" hideBelow="sm" />
        <Link href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          color="ui.heading" fontWeight="500" fontSize="0.9688rem" hideBelow="sm" _hover={{ opacity: 0.7 }}>Forge</Link>
        <chakra.button ml="auto" type="button" onClick={onOpenSettings} aria-label="Settings" title="Settings"
          display="inline-flex" alignItems="center" justifyContent="center" flex="none" w="2.25rem" h="2.25rem"
          border="0" bg="transparent" borderRadius="forge" color="ui.muted" cursor="pointer"
          transition="color .15s ease, background .15s ease"
          _hover={{ color: 'ui.heading', bg: 'ui.ghostHover' }}>
          <GearIcon />
        </chakra.button>
      </Flex>
    </Box>
  );
}
