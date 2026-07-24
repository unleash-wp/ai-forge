// Select - a custom, accessible dropdown/combobox (native <select> can't be styled
// cross-browser). options: [{ value, label }]; value '' shows the placeholder.
// `searchable` adds a filter box; keyboard: Up/Down/Home/End/Enter/Escape with
// aria-activedescendant. Rendered options are capped for very long lists.
import { useState, useRef, useEffect, useId } from 'react';

const OPT_CAP = 100;

export function Select({ value, onChange, options, placeholder = 'Select', disabled, block, searchable, ariaLabel }) {
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
    const idx = options.findIndex((o) => o.value === value); // start on the current value
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
    <div className={'ui-select' + (block ? ' block' : '') + (open ? ' open' : '') + (disabled ? ' disabled' : '')} ref={ref} onKeyDown={onKeyDown}>
      <button ref={btnRef} type="button" className="ui-select-btn" disabled={disabled} aria-label={ariaLabel}
        aria-haspopup="listbox" aria-expanded={open} aria-activedescendant={!searchable ? activeId : undefined}
        onClick={() => setOpen((o) => !o)}>
        <span title={sel ? sel.label : undefined}>{sel ? sel.label : placeholder}</span>
        <svg className="ui-select-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="ui-select-menu" role="listbox" aria-label={ariaLabel} ref={menuRef}>
          {searchable && (
            <input ref={searchRef} className="ui-select-search" value={query} placeholder="Search…" spellCheck="false" aria-label="Filter options"
              aria-activedescendant={activeId} onChange={(e) => setQuery(e.target.value)} onClick={(e) => e.stopPropagation()} />
          )}
          {shown.map((o, i) => (
            <button key={o.value} id={base + '-opt-' + i} data-idx={i} type="button" role="option" aria-selected={o.value === value} title={o.label}
              className={'ui-select-opt' + (o.value === value ? ' sel' : '') + (i === active ? ' active' : '')}
              onMouseEnter={() => setActive(i)} onClick={() => pick(o)}>{o.label}</button>
          ))}
          {shown.length === 0 && <div className="ui-select-note">No matches</div>}
          {filtered.length > OPT_CAP && <div className="ui-select-note">+{filtered.length - OPT_CAP} more — refine search</div>}
        </div>
      )}
    </div>
  );
}
