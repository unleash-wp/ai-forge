// Checkbox — Chakra Checkbox. Adapts onCheckedChange back to the classic
// onChange(e.target.checked) so existing call sites keep working.
import { Checkbox as CChk } from '@chakra-ui/react';

export function Checkbox({ checked, onChange, disabled, ...rest }) {
  return (
    <CChk.Root
      checked={checked}
      disabled={disabled}
      colorPalette="brand"
      onCheckedChange={(d) => onChange && onChange({ target: { checked: d.checked === true } })}
      {...rest}
    >
      <CChk.HiddenInput />
      <CChk.Control _checked={{ bg: 'navy', borderColor: 'navy', color: 'white' }} />
    </CChk.Root>
  );
}
