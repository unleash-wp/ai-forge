// Button - variant (primary|ghost), size (sm), danger. Composes the SCSS classes.
export function Button({ variant = 'ghost', size, danger, className, children, type = 'button', ...rest }) {
  const cls = ['c-button--' + variant, size && 'c-button--' + size, danger && 'c-button--danger', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest}>{children}</button>;
}
