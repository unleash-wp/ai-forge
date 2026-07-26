// The app's branded landing. Presents Forge as an UnleashWP platform — the brand
// wordmark + one card per installed tool (the changelog is just the first). Shown
// in the browser and, since it's the same bundle, inside the Claude Desktop window.
// Kept minimal on purpose: brand + tools, no dashboards.
import { Box, Flex, Heading, SimpleGrid, Text, chakra } from '@chakra-ui/react';
import { LOGO_FULL, LOGO_WHITE } from '../brand.js';
import { ToolIcon } from '../icons.jsx';
import { useT } from '../i18n.jsx';

// Keep in sync with App.jsx — opening the Plugins manager.
const PLUGINS_VIEW = '__plugins__';

export default function HomeView({ plugins, openTool }) {
  const t = useT();
  const tools = plugins.filter((p) => p.enabled !== false);

  return (
    <Box>
      {/* Brand header */}
      <Box mb="8">
        <Box _dark={{ display: 'none' }} css={{ '& svg': { height: '1.75rem', width: 'auto', display: 'block' } }} dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
        <Box display="none" _dark={{ display: 'block' }} css={{ '& svg': { height: '1.75rem', width: 'auto', display: 'block' } }} dangerouslySetInnerHTML={{ __html: LOGO_WHITE }} />
        <Flex align="baseline" gap="2.5" mt="3.5" flexWrap="wrap">
          <Heading as="h1" fontSize="1.375rem" fontWeight="800" letterSpacing="-.02em" color="ui.heading">AI Forge</Heading>
          <Text color="ui.muted" fontSize="0.9375rem">{t('The AI tool for WordPress.')}</Text>
        </Flex>
      </Box>

      {/* Your tools */}
      <Text fontSize="0.6875rem" fontWeight="700" letterSpacing=".08em" textTransform="uppercase" color="ui.muted" mb="3">{t('Your tools')}</Text>
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3.5">
        {tools.map((p) => (
          <chakra.button key={p.id} type="button" onClick={() => openTool(p.id)} textAlign="left"
            borderWidth="1px" borderColor="ui.border" borderRadius="forge" bg="ui.surface" px="5" py="4.5" cursor="pointer"
            transition="border-color .12s, background .12s, transform .12s"
            _hover={{ borderColor: 'ui.primary', bg: 'ui.sunk', transform: 'translateY(-1px)' }}>
            <Flex align="center" gap="3" mb="2.5">
              <Flex flex="none" w="2.25rem" h="2.25rem" display="grid" placeItems="center" borderRadius="sm" bg="navy" color="white"
                css={{ '& svg': { width: '1.25rem', height: '1.25rem' } }}><ToolIcon name={p.icon} size={20} /></Flex>
              <chakra.span fontWeight="700" fontSize="0.9375rem" color="ui.heading">{t(p.name)}</chakra.span>
            </Flex>
            <Text fontSize="0.8125rem" color="ui.muted" lineHeight="1.5">{t(p.description)}</Text>
          </chakra.button>
        ))}

        {/* Add a tool → the Plugins manager */}
        <chakra.button type="button" onClick={() => openTool(PLUGINS_VIEW)} textAlign="left"
          borderWidth="1px" borderStyle="dashed" borderColor="ui.border" borderRadius="forge" bg="transparent" px="5" py="4.5" cursor="pointer"
          transition="border-color .12s, background .12s" _hover={{ borderColor: 'ui.primary', bg: 'ui.sunk' }}>
          <chakra.span display="block" fontWeight="700" fontSize="0.9375rem" color="ui.text" mb="1.5">{t('Add a tool')}</chakra.span>
          <Text fontSize="0.8125rem" color="ui.muted" lineHeight="1.5">{t('Every tool is a plugin. More are coming — or build your own.')}</Text>
        </chakra.button>
      </SimpleGrid>
    </Box>
  );
}
