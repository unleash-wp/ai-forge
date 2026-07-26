// The app's landing: a plain "Welcome", then the installed tools as a compact
// grid of cards (3 per row) — icon, name, short description, click to open. Same
// bundle, so it also shows inside the Claude Desktop window. Kept plain: no border
// (soft shadow only), no invented decoration. (No "add a tool" card yet.)
import { Box, Flex, Heading, SimpleGrid, Text, chakra } from '@chakra-ui/react';
import { ToolIcon } from '../icons.jsx';
import { useT } from '../i18n.jsx';

export default function HomeView({ plugins, openTool }) {
  const t = useT();
  const tools = plugins.filter((p) => p.enabled !== false);

  return (
    <Box>
      <Heading as="h1" fontSize="1.75rem" fontWeight="800" letterSpacing="-.02em" color="ui.heading" mb="6">{t('Welcome')}</Heading>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="4">
        {tools.map((p) => (
          <chakra.button key={p.id} type="button" onClick={() => openTool(p.id)} textAlign="left"
            display="flex" flexDirection="column" gap="3" minH="8rem" p="4" cursor="pointer"
            bg="ui.surface" borderRadius="forge" boxShadow="sm"
            transition="transform .14s ease, box-shadow .14s ease"
            _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}>
            <Flex flex="none" w="2.5rem" h="2.5rem" display="grid" placeItems="center" borderRadius="forge" bg="navy" color="white"
              css={{ '& svg': { width: '1.375rem', height: '1.375rem' } }}><ToolIcon name={p.icon} size={22} /></Flex>
            <Box>
              <chakra.span display="block" fontWeight="700" fontSize="0.9375rem" color="ui.heading">{t(p.name)}</chakra.span>
              <Text fontSize="0.75rem" color="ui.muted" lineHeight="1.45" mt="0.5"
                css={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t(p.description)}</Text>
            </Box>
          </chakra.button>
        ))}
      </SimpleGrid>
    </Box>
  );
}
