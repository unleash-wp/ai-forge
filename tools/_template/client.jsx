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
// Copy this folder to tools/<your-id>/, edit plugin.json, then `npm run build`.
import { useState } from 'react';
import { useCore } from '../../src/client/core.jsx';
import { Button } from '../../src/client/ui';

export default function MyTool() {
  const core = useCore();
  const [n, setN] = useState(0);

  return (
    <section className="filters">
      <p>Your tool UI goes here. Compose it from the shared components (and reuse the
        existing class names like <code>filters</code>, <code>stat</code>, …).</p>
      <div className="go">
        <Button variant="primary" onClick={() => { setN(n + 1); core.toast('Clicked ' + (n + 1)); }}>
          Clicked {n} times
        </Button>
      </div>
    </section>
  );
}
