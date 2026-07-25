// A Forge tool is a default-exported React component. The shell mounts it in
// <main> when its rail entry is active, and owns the header, rail, setup wizard
// and toast around it.
//
// Reuse the shared design-system components from ../../src/client/ui - Button,
// TextInput, TextArea, Checkbox, Select (a searchable, keyboard-accessible
// dropdown) - and the tool icons from ../../src/client/icons.jsx, so your tool
// matches the rest of Forge. Talk to the shell through useCore():
//   { toast(msg), openSetup(), status, refreshStatus(), hooks }
//
// Styling is Chakra UI v3 (see CONTRIBUTING.md, "Frontend & styles"): compose
// Chakra primitives and style with the `ui.*` semantic tokens + colorPalette
// "brand" - no CSS file. Copy this folder to tools/<your-id>/, edit plugin.json,
// build.
import { useState } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { useCore } from '../../src/client/core.jsx';
import { Button } from '../../src/client/ui';

export default function MyTool() {
  const core = useCore();
  const [n, setN] = useState(0);

  return (
    <Box bg="ui.surface" borderColor="ui.border" borderWidth="1px" rounded="forge" p={4}>
      <Text color="ui.muted" mb={3}>
        Your tool UI goes here. Compose it from the shared components and Chakra
        primitives, styled with <code>ui.*</code> tokens.
      </Text>
      <Button variant="primary" onClick={() => { setN(n + 1); core.toast('Clicked ' + (n + 1)); }}>
        Clicked {n} times
      </Button>
    </Box>
  );
}
