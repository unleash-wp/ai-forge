// Button - variant (primary|ghost), size (sm), danger. Composes the SCSS classes.
export function Button({ variant = 'ghost', size, danger, className, children, type = 'button', ...rest }) {
  const cls = [variant, size, danger && 'danger', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest}>{children}</button>;
}
