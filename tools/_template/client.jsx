// A Forge tool is a default-exported React component. The shell mounts it in
// <main> when its rail entry is active, and owns the header, rail, setup wizard
// and toast around it.
//
// Reuse the shared design-system components from ../../src/client/ui - Button,
// TextInput, TextArea, Checkbox, Select (a searchable, keyboard-accessible
// dropdown) - and the tool icons from ../../src/client/icons.jsx, so your tool
// matches the rest of Forge. Talk to the shell through useCore():
//   { toast(msg), openSetup(), status, refreshStatus() }
//
// Styling is BEMIT (see CONTRIBUTING.md, "Frontend & styles"): reuse shared
// classes like `c-filters` / `c-card`, or add your own in a co-located
// client.scss. Copy this folder to tools/<your-id>/, edit plugin.json, build.
import { useState } from 'react';
import { useCore } from '../../src/client/core.jsx';
import { Button } from '../../src/client/ui';

export default function MyTool() {
  const core = useCore();
  const [n, setN] = useState(0);

  return (
    <section className="c-filters">
      <p>Your tool UI goes here. Compose it from the shared components and the
        design-system classes (<code>c-filters</code>, <code>c-card</code>, …).</p>
      <Button variant="primary" onClick={() => { setN(n + 1); core.toast('Clicked ' + (n + 1)); }}>
        Clicked {n} times
      </Button>
    </section>
  );
}
