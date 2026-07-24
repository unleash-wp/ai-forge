// A Forge tool is a default-exported React component. The shell mounts it in
// <main> when its rail entry is active, and owns the header, rail, setup wizard
// and toast around it. Talk to the shell through useCore():
//   { toast(msg), openSetup(), status, refreshStatus() }
//
// Copy this folder to tools/<your-id>/, edit plugin.json, then `npm run build`.
import { useState } from 'react';
import { useCore } from '../../src/client/core.jsx';

export default function MyTool() {
  const core = useCore();
  const [n, setN] = useState(0);

  return (
    <section className="filters">
      <p>Your tool UI goes here. Reuse the existing class names (<code>filters</code>,
        <code> primary</code>, <code>ghost sm</code>, <code>stat</code>, …) so it matches the design system.</p>
      <div className="go">
        <button className="primary" type="button" onClick={() => { setN(n + 1); core.toast('Clicked ' + (n + 1)); }}>
          Clicked {n} times
        </button>
      </div>
    </section>
  );
}
