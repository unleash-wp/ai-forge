// TextArea: Chakra Textarea, monospace, vertical resize.
import { Textarea } from '@chakra-ui/react';

export function TextArea(props) {
  return (
    <Textarea bg="ui.sunk" borderWidth="1px" borderColor="ui.border" borderRadius="forge" color="ui.text"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="0.8125rem" resize="vertical"
      _focus={{ bg: 'ui.surface', borderColor: 'ui.primary', boxShadow: '0 0 0 3px var(--chakra-colors-ui-ring)' }}
      {...props} />
  );
}
