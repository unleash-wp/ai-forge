// Global UI components (the Forge design-system primitives). Use these instead
// of raw <button>/<input>/<select> so every tool + the shell stay consistent.
// Styling lives in the SCSS (.primary/.ghost, input, .ui-select, …).
import { useState, useRef, useEffect } from 'react';

export function Button({ variant = 'ghost', size, danger, className, children, type = 'button', ...rest }) {
  const cls = [variant, size, danger && 'danger', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest}>{children}</button>;
}

export function TextInput({ type = 'text', className, ...rest }) {
  return <input type={type} className={className} {...rest} />;
}

export function TextArea({ className, ...rest }) {
  return <textarea className={className} {...rest} />;
}

export function Checkbox({ className, ...rest }) {
  return <input type="checkbox" className={className} {...rest} />;
}

// Custom dropdown so it matches the design system (native <select> can't be
// styled cross-browser). options: [{ value, label }]. value '' shows placeholder.
// searchable adds a filter box + caps how many options render (for long lists).
const OPT_CAP = 100;
export function Select({ value, onChange, options, placeholder = 'Select', disabled, block, searchable }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    if (searchable && searchRef.current) searchRef.current.focus();
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open, searchable]);

  const sel = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = searchable && q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const shown = filtered.slice(0, OPT_CAP);

  return (
    <div className={'ui-select' + (block ? ' block' : '') + (open ? ' open' : '') + (disabled ? ' disabled' : '')} ref={ref}>
      <button type="button" className="ui-select-btn" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{sel ? sel.label : placeholder}</span>
        <svg className="ui-select-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="ui-select-menu" role="listbox">
          {searchable && (
            <input ref={searchRef} className="ui-select-search" value={query} placeholder="Search…" spellCheck="false"
              onChange={(e) => setQuery(e.target.value)} onClick={(e) => e.stopPropagation()} />
          )}
          {shown.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value}
              className={'ui-select-opt' + (o.value === value ? ' sel' : '')}
              onClick={() => { onChange(o.value); setOpen(false); }}>{o.label}</button>
          ))}
          {shown.length === 0 && <div className="ui-select-note">No matches</div>}
          {filtered.length > OPT_CAP && <div className="ui-select-note">+{filtered.length - OPT_CAP} more — refine search</div>}
        </div>
      )}
    </div>
  );
}
