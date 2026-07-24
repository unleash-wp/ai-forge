// TextInput - styled text/password input (styling from the global `input` rule).
export function TextInput({ type = 'text', className, ...rest }) {
  return <input type={type} className={className} {...rest} />;
}
