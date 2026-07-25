// The white brand bar: UnleashWP wordmark + "Forge" + credential status pills.
import { Box, Button, Circle, Flex, Link, Separator } from '@chakra-ui/react';
import { LOGO_FULL } from '../brand.js';

function Pill({ ok, label, onClick }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} borderRadius="forge" bg="ui.sunk" borderColor="ui.border"
      color="ui.text" fontWeight="500" fontSize="0.7813rem" gap="1.5" px="3.5" py="2"
      _hover={{ borderColor: 'ui.primary', transform: 'translateY(-1px)' }}>
      <Circle size="1rem" fontSize="0.625rem" fontWeight="700" lineHeight="1"
        bg={ok ? 'ui.good' : 'transparent'} color={ok ? 'white' : 'yellow'}
        borderWidth={ok ? '0' : '1.5px'} borderColor="yellow">{ok ? '✓' : ''}</Circle>
      {label}
    </Button>
  );
}

export default function Header({ headerRef, scrolled, ghSet, tracSet, onToggleSetup }) {
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
        <Flex ml="auto" gap="2">
          <Pill ok={ghSet} label="GitHub" onClick={onToggleSetup} />
          <Pill ok={tracSet} label="Trac" onClick={onToggleSetup} />
        </Flex>
      </Flex>
    </Box>
  );
}
