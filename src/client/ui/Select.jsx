// Select - a custom, accessible dropdown/combobox styled with Chakra primitives
// (native <select> can't be styled cross-browser; Chakra's own Select isn't
// searchable). options: [{ value, label }]; value '' shows the placeholder.
// `searchable` adds a filter box; keyboard: Up/Down/Home/End/Enter/Escape.
import { useState, useRef, useEffect, useId } from 'react';
import { Box, Input, chakra } from '@chakra-ui/react';
import { __ } from '../i18n.jsx';

const OPT_CAP = 100;
const CButton = chakra('button');

export function Select({ value, onChange, options, placeholder = __('Select'), disabled, block, searchable, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const base = useId();

  const sel = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = searchable && q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const shown = filtered.slice(0, OPT_CAP);

  useEffect(() => {
    if (!open) { setQuery(''); setActive(-1); return; }
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 && idx < OPT_CAP ? idx : 0);
    if (searchable && searchRef.current) searchRef.current.focus();
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) setActive((a) => Math.min(Math.max(a, 0), Math.max(shown.length - 1, 0))); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && active >= 0 && menuRef.current) {
      const el = menuRef.current.querySelector('[data-idx="' + active + '"]');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [active, open]);

  const closeTo = (focusBtn) => { setOpen(false); if (focusBtn && btnRef.current) btnRef.current.focus(); };
  const pick = (o) => { onChange(o.value); closeTo(true); };

  function onKeyDown(e) {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); closeTo(true); }
  }

  const activeId = open && active >= 0 && shown[active] ? base + '-opt-' + active : undefined;

  return (
    <Box position="relative" ref={ref} onKeyDown={onKeyDown}
      display={block ? 'block' : 'inline-block'} w={block ? 'full' : undefined} minW={block ? '0' : '10rem'}>
      <CButton ref={btnRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox"
        aria-expanded={open} aria-activedescendant={!searchable ? activeId : undefined} onClick={() => setOpen((o) => !o)}
        display="inline-flex" alignItems="center" justifyContent="space-between" gap="2" w="full" px="3.5" py="2.5"
        borderWidth="1px" borderColor={open ? 'ui.primary' : 'ui.border'} borderRadius="0.4375rem" bg="ui.surface"
        color="ui.text" fontSize="1rem" cursor={disabled ? 'default' : 'pointer'} opacity={disabled ? 0.55 : 1}
        transition="border-color .12s, box-shadow .12s" boxShadow={open ? '0 0 0 3px var(--chakra-colors-ui-ring)' : 'none'}
        _hover={{ borderColor: 'ui.primary' }}>
        <chakra.span flex="1" minW="0" textAlign="left" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" title={sel ? sel.label : undefined}>{sel ? sel.label : placeholder}</chakra.span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color: 'var(--chakra-colors-ui-muted)', transition: 'transform .14s ease', transform: open ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9" /></svg>
      </CButton>
      {open && (
        <Box ref={menuRef} role="listbox" aria-label={ariaLabel} position="absolute" zIndex="30" top="calc(100% + 0.375rem)" left="0"
          minW="full" maxW="24rem" bg="ui.surface" borderWidth="1px" borderColor="ui.border" borderRadius="0.5rem"
          boxShadow="lg" p="1.5" display="flex" flexDir="column" gap="0.5" maxH="18rem" overflowY="auto">
          {searchable && (
            <Input ref={searchRef} value={query} placeholder={__('Search…')} spellCheck="false" aria-label={__('Filter options')}
              aria-activedescendant={activeId} onChange={(e) => setQuery(e.target.value)} onClick={(e) => e.stopPropagation()}
              flex="none" position="sticky" top="0" mb="1" px="2.5" py="1.5" bg="ui.sunk" borderWidth="1px" borderColor="ui.border"
              borderRadius="0.375rem" fontSize="0.8125rem" _focus={{ bg: 'ui.surface', borderColor: 'ui.primary' }} />
          )}
          {shown.map((o, i) => (
            <CButton key={o.value} id={base + '-opt-' + i} data-idx={i} type="button" role="option" aria-selected={o.value === value}
              title={o.label} onMouseEnter={() => setActive(i)} onClick={() => pick(o)} flex="none" textAlign="left" cursor="pointer"
              px="2.5" py="2" borderRadius="0.375rem" fontSize="0.875rem" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis"
              bg={i === active ? 'rgba(59,130,246,.14)' : 'transparent'} color={o.value === value ? 'ui.primary' : 'ui.text'}
              fontWeight={o.value === value ? '600' : '400'} _hover={{ bg: 'rgba(59,130,246,.14)' }}>{o.label}</CButton>
          ))}
          {shown.length === 0 && <Box flex="none" px="2.5" py="2" fontSize="0.75rem" color="ui.muted">{__('No matches')}</Box>}
          {filtered.length > OPT_CAP && <Box flex="none" px="2.5" py="2" fontSize="0.75rem" color="ui.muted">{__('+%s more, refine search', filtered.length - OPT_CAP)}</Box>}
        </Box>
      )}
    </Box>
  );
}
