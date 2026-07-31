// TextInput: Chakra Input on the Forge surface tokens.
import { Input } from '@chakra-ui/react';

export function TextInput({ type = 'text', ...rest }) {
  return (
    <Input type={type} bg="ui.sunk" borderWidth="1px" borderColor="ui.border" borderRadius="forge" color="ui.text"
      _focus={{ bg: 'ui.surface', borderColor: 'ui.primary', boxShadow: '0 0 0 3px var(--chakra-colors-ui-ring)' }}
      {...rest} />
  );
}
