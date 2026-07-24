// Global UI components (the Forge design-system primitives). Use these instead
// of raw <button>/<input>/<select> so every tool + the shell stay consistent.
// Styling lives in the SCSS (.primary/.ghost, input, .ui-select, …).
import { useState, useRef, useEffect } from 'react';

export function Button({ variant = 'ghost', size, danger, className, children, type = 'button', ...rest }) {
  const cls = [variant, size, danger && 'danger', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest}>{children}</button>;
}

export function TextInput({ className, ...rest }) {
  return <input type="text" className={className} {...rest} />;
}

export function Checkbox({ className, ...rest }) {
  return <input type="checkbox" className={className} {...rest} />;
}

// Custom dropdown so it matches the design system (native <select> can't be
// styled cross-browser). options: [{ value, label }]. value '' shows placeholder.
export function Select({ value, onChange, options, placeholder = 'Select', disabled, minWidth }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const sel = options.find((o) => o.value === value);
  return (
    <div className={'ui-select' + (open ? ' open' : '') + (disabled ? ' disabled' : '')} ref={ref} style={minWidth ? { minWidth } : undefined}>
      <button type="button" className="ui-select-btn" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{sel ? sel.label : placeholder}</span>
        <svg className="ui-select-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="ui-select-menu" role="listbox">
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value}
              className={'ui-select-opt' + (o.value === value ? ' sel' : '')}
              onClick={() => { onChange(o.value); setOpen(false); }}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
