// Left tool rail: one tile per installed+enabled tool (from /api/plugins) plus
// the Plugins manager entry. Icons come from each tool's manifest icon keyword.
import { Box, Button, Stack, Text } from '@chakra-ui/react';
import { ToolIcon, PluginsIcon, HomeIcon } from '../icons.jsx';
import { useT } from '../i18n.jsx';

function Tile({ active, icon, name, ariaCurrent, onClick }) {
  return (
    <Button onClick={onClick} aria-current={ariaCurrent} variant="plain" h="auto" w="full"
      flexDir="column" gap="1" py="3" px="1.5" borderRadius="forge" cursor={active ? 'default' : 'pointer'}
      bg={active ? 'navy' : 'ui.sunk'} color={active ? 'white' : 'ui.text'} boxShadow={active ? 'sm' : 'none'}
      transition="transform .12s ease, box-shadow .12s ease, background .14s ease"
      _hover={active ? {} : { transform: 'translateY(-1px)', boxShadow: 'sm' }}>
      <Box display="grid" placeItems="center">{icon}</Box>
      <Text fontSize="0.5938rem" fontWeight="500" lineHeight="1.25">{name}</Text>
    </Button>
  );
}

export default function Rail({ railRef, plugins, activeId, inHome, inPlugins, onHome, onSelect, onPlugins }) {
  const t = useT();
  return (
    <Stack as="aside" ref={railRef} position="sticky" top="5.125rem" mt="8" gap="2"
      direction={{ base: 'row', lg: 'column' }} flexWrap={{ base: 'wrap', lg: 'nowrap' }}>
      <Tile active={inHome} ariaCurrent={inHome ? 'true' : undefined} onClick={onHome}
        name={t('Home')} icon={<HomeIcon size={18} />} />
      <Text fontSize="0.5938rem" fontWeight="600" letterSpacing=".12em" textTransform="uppercase" color="ui.muted" px="0.5" w={{ base: 'full', lg: 'auto' }}>{t('Tools')}</Text>
      {plugins.filter((p) => p.enabled !== false).map((p) => (
        <Tile key={p.id} active={p.id === activeId} ariaCurrent={p.id === activeId ? 'true' : undefined}
          onClick={() => onSelect(p.id)} name={t(p.name)} icon={<ToolIcon name={p.icon} size={18} />} />
      ))}
      <Tile active={inPlugins} ariaCurrent={inPlugins ? 'true' : undefined} onClick={onPlugins}
        name={t('Plugins')} icon={<PluginsIcon size={18} />} />
    </Stack>
  );
}
