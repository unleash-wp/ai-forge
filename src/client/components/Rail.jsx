// The primary nav, living inside the app-shell sidebar column (that column owns
// the surface + divider, so the items sit flush in the frame, not floating).
// Collapsible from the header burger: expanded = icon + label side by side;
// collapsed = icons only (label as tooltip). On mobile the column becomes a top
// bar and this lays the tiles out in a row with labels.
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { ToolIcon, PluginsIcon, HomeIcon, SettingsIcon } from '../icons.jsx';
import { useT } from '../i18n.jsx';

function Tile({ active, collapsed, icon, name, ariaCurrent, onClick }) {
  return (
    <Button onClick={onClick} aria-current={ariaCurrent} aria-label={name} title={collapsed ? name : undefined}
      variant="plain" w="full" gap="0" borderRadius="forge" overflow="hidden"
      h={{ base: 'auto', lg: '2.75rem' }} py={{ base: '2.5', lg: '0' }} px={{ base: '3', lg: '0' }} justifyContent="flex-start"
      cursor={active ? 'default' : 'pointer'}
      bg={active ? 'navy' : 'transparent'} color={active ? 'white' : 'ui.text'} boxShadow={active ? 'sm' : 'none'}
      transition="background .14s ease, color .14s ease, box-shadow .14s ease"
      _hover={active ? {} : { bg: 'ui.sunk' }}>
      {/* Fixed square icon cell, anchored left: icon is dead-centered in it and never
          moves. Collapsed the tile shrinks to exactly this square (1:1, centered);
          expanded the label sits to its right. */}
      <Box flex="none" display="grid" placeItems="center" mr={{ base: '2.5', lg: '0' }}
        w={{ base: '1.5rem', lg: '2.75rem' }} h={{ base: '1.5rem', lg: '2.75rem' }}>{icon}</Box>
      <Text as="span" display="block" fontSize="0.875rem" fontWeight={active ? '600' : '500'} whiteSpace="nowrap" overflow="hidden"
        maxW={{ base: '11rem', lg: collapsed ? '0' : '11rem' }} opacity={{ base: 1, lg: collapsed ? 0 : 1 }}
        transition="max-width .34s cubic-bezier(.34,1.56,.64,1), opacity .2s ease">{name}</Text>
    </Button>
  );
}

export default function Rail({ plugins, activeId, inHome, inPlugins, collapsed, onHome, onSelect, onPlugins, onOpenSettings }) {
  const t = useT();
  const tools = plugins.filter((p) => p.enabled !== false);
  return (
    <Flex direction={{ base: 'row', lg: 'column' }} align="stretch" gap="1" h={{ lg: '100%' }} flexWrap={{ base: 'wrap', lg: 'nowrap' }}>
      <Tile collapsed={collapsed} active={inHome} ariaCurrent={inHome ? 'true' : undefined} onClick={onHome}
        name={t('Start')} icon={<HomeIcon size={18} />} />
      {tools.map((p) => (
        <Tile key={p.id} collapsed={collapsed} active={p.id === activeId} ariaCurrent={p.id === activeId ? 'true' : undefined}
          onClick={() => onSelect(p.id)} name={t(p.name)} icon={<ToolIcon name={p.icon} size={18} />} />
      ))}
      {/* Spacer pushes the meta group (Plugins + Settings) to the bottom (lg only). */}
      <Box flex="1" display={{ base: 'none', lg: 'block' }} aria-hidden="true" />
      {/* Hairline separating the tools from the meta group. */}
      <Box display={{ base: 'none', lg: 'block' }} h="1px" bg="ui.border" mx="2" mb="1.5" aria-hidden="true" />
      <Tile collapsed={collapsed} active={inPlugins} ariaCurrent={inPlugins ? 'true' : undefined} onClick={onPlugins}
        name={t('Plugins')} icon={<PluginsIcon size={18} />} />
      <Tile collapsed={collapsed} active={false} onClick={onOpenSettings}
        name={t('Settings')} icon={<SettingsIcon size={18} />} />
    </Flex>
  );
}
