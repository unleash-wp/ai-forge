// Button - variant (primary|ghost), size (sm), danger. Composes the SCSS classes.
export function Button({ variant = 'ghost', size, danger, className, children, type = 'button', ...rest }) {
  const cls = ['button--' + variant, size && 'button--' + size, danger && 'button--danger', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest}>{children}</button>;
}
