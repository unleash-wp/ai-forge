// Checkbox - a real <input type=checkbox> (Material styling from the global rule).
export function Checkbox({ className, ...rest }) {
  return <input type="checkbox" className={className} {...rest} />;
}
