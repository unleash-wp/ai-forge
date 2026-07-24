// TextArea - styled multiline input (styling from the global `textarea` rule).
export function TextArea({ className, ...rest }) {
  return <textarea className={className} {...rest} />;
}
