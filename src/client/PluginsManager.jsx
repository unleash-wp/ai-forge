// The visible plugin system: a manager view listing the tools installed on this
// Forge (from /api/plugins), their version/author/price + update status, and a
// "build your own" card. Reached from the rail's Plugins entry.
import { useState, useEffect } from 'react';

const CODE_IC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';

export default function PluginsManager({ plugins, onOpen }) {
  const [updates, setUpdates] = useState([]);
  useEffect(() => {
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  const upFor = (id) => updates.find((u) => u.id === id);

  return (
    <div className="plugins-grid">
      {plugins.map((p) => {
        const up = upFor(p.id);
        return (
          <div className="plugin-card" key={p.id}>
            <div className="pc-top">
              <span className="pc-ic" dangerouslySetInnerHTML={{ __html: CODE_IC }} />
              <div>
                <h3>{p.name}</h3>
                <div className="pc-meta">v{p.version}{p.author ? ' · ' + p.author : ''}</div>
              </div>
            </div>
            <p>{p.description}</p>
            <div className="pc-foot">
              <span className="badge-free">{p.price === 'free' ? 'Free' : p.price}</span>
              {up && <a className="badge-up" href={up.url} target="_blank" rel="noopener">Update → {up.latest}</a>}
              <button className="ghost sm pc-open" type="button" onClick={() => onOpen(p.id)}>Open</button>
            </div>
          </div>
        );
      })}
      <a className="plugin-card pc-add" href="https://github.com/unleash-wp/wp-release-helper/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">
        <span className="pc-plus">+</span>
        <h3>Build a tool</h3>
        <p>Every tool is a folder under <code>tools/</code>. Copy the template, add a manifest and a React component, and it shows up here.</p>
        <span className="pc-cta">Read the guide →</span>
      </a>
    </div>
  );
}
