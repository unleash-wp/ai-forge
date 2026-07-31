// Button: Chakra Button with the Forge variants. Keeps the wrapper API
// (variant primary|ghost, size sm, danger) so call sites don't change.
import { Button as CButton } from '@chakra-ui/react';

export function Button({ variant = 'ghost', size, danger, children, ...rest }) {
  const common = { size: size === 'sm' ? 'sm' : 'md', borderRadius: 'forge', fontWeight: '500', h: 'auto', py: size === 'sm' ? '2.5' : '3',
    _focusVisible: { outline: '2px solid', outlineColor: 'ui.primary', outlineOffset: '2px' } };
  if (variant === 'primary') {
    return (
      <CButton {...common} bg="navy" color="white" boxShadow="sm"
        _hover={{ bg: 'yellow', color: 'navy' }}
        _active={{ transform: 'translateY(1px)' }}
        _disabled={{ opacity: 0.55, bg: 'navy', color: 'white', cursor: 'default' }}
        {...rest}>{children}</CButton>
    );
  }
  return (
    <CButton {...common} variant="outline" color="ui.primary" borderColor="ui.border"
      _hover={danger ? { color: 'ui.bad', borderColor: 'ui.bad' } : { borderColor: 'ui.primary', bg: 'ui.ghostHover' }}
      _active={{ transform: 'translateY(1px)' }}
      {...rest}>{children}</CButton>
  );
}
