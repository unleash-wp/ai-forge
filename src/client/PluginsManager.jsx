// The visible plugin system: lists the tools installed on this Forge (from
// /api/plugins) with version/author/price + update status, and installs new ones
// from a GitHub repo URL or an uploaded .zip. Installing runs the tool's code
// after a server-side rebuild, so it is gated behind the user's own action and a
// trust note. Uninstall + install both rebuild the bundle, then reload the page.
import { useState, useEffect, useRef } from 'react';

const CODE_IC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';

export default function PluginsManager({ plugins, onOpen }) {
  const [updates, setUpdates] = useState([]);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState('');       // message while installing/removing
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  const upFor = (id) => updates.find((u) => u.id === id);

  function afterInstall(label, promise) {
    setErr(''); setBusy(label);
    promise
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setBusy('Done. Reloading…'); window.location.reload(); }
        else { setBusy(''); setErr(d.error || 'failed'); }
      })
      .catch(() => { setBusy(''); setErr('request failed'); });
  }
  function installUrl() {
    const s = source.trim();
    if (!s) { setErr('Paste a GitHub repo URL first.'); return; }
    afterInstall('Installing from ' + s + '… building the bundle, then the page reloads.',
      fetch('/api/plugins/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: s }) }));
  }
  function uploadZip(file) {
    if (!file) return;
    afterInstall('Installing ' + file.name + '… building the bundle, then the page reloads.',
      fetch('/api/plugins/upload', { method: 'POST', body: file }));
  }
  function remove(id, name) {
    if (!window.confirm('Remove "' + name + '"? This deletes it from tools/ and rebuilds.')) return;
    afterInstall('Removing ' + name + '… rebuilding.',
      fetch('/api/plugins/uninstall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }));
  }

  return (
    <>
      {busy && <div className="warn">{busy}</div>}
      {err && <div className="warn bad-note">{err}</div>}
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
                {p.id !== 'changelog' && <button className="ghost sm" type="button" disabled={!!busy} onClick={() => remove(p.id, p.name)}>Remove</button>}
              </div>
            </div>
          );
        })}

        <div className="plugin-card pc-install">
          <div className="pc-top">
            <span className="pc-plus">+</span>
            <div><h3>Add a tool</h3><div className="pc-meta">Install from GitHub or a .zip</div></div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); installUrl(); }} style={{ margin: 0 }}>
            <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="github:owner/repo or https://github.com/owner/repo" spellCheck="false" disabled={!!busy} />
            <div className="pc-actions">
              <button className="primary sm" type="submit" disabled={!!busy}>Install</button>
              <button className="ghost sm" type="button" disabled={!!busy} onClick={() => fileRef.current && fileRef.current.click()}>Upload .zip</button>
              <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={(e) => uploadZip(e.target.files[0])} />
            </div>
          </form>
          <p className="pc-trust">Installs run the tool's code on this machine. Only install tools you trust. <a href="https://github.com/unleash-wp/wp-release-helper/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Build your own →</a></p>
        </div>
      </div>
    </>
  );
}
