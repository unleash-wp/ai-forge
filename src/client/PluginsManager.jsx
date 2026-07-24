// The visible plugin system as a polished vertical list (rows, not cards): each
// installed tool is a row with an icon, name + description, meta, and right-
// aligned action buttons. WP-style lifecycle: install (GitHub URL / .zip),
// activate/deactivate (instant, no rebuild), remove; an All/Inactive filter +
// search. Installing runs the tool's code after a server-side rebuild (gated
// behind the user's own action + trust note).
import { useState, useEffect, useRef } from 'react';

const CODE_IC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';

export default function PluginsManager({ plugins, onOpen, onChanged }) {
  const [updates, setUpdates] = useState([]);
  const [source, setSource] = useState('');
  const [iq, setIq] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
  }, []);
  const upFor = (id) => updates.find((u) => u.id === id);
  const inactiveCount = plugins.filter((p) => p.enabled === false).length;

  function afterInstall(label, promise) {
    setErr(''); setBusy(label);
    promise
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setBusy('Done. Reloading…'); window.location.reload(); } else { setBusy(''); setErr(d.error || 'failed'); } })
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
  function toggle(id, enabled) {
    setErr('');
    fetch('/api/plugins/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, enabled }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) { if (onChanged) onChanged(); } else setErr(d.error || 'failed'); })
      .catch(() => setErr('request failed'));
  }

  const shown = plugins
    .filter((p) => (filter === 'inactive' ? p.enabled === false : true))
    .filter((p) => (p.name + ' ' + (p.description || '')).toLowerCase().includes(iq.trim().toLowerCase()));

  return (
    <>
      {busy && <div className="warn">{busy}</div>}
      {err && <div className="warn bad-note">{err}</div>}

      <div className="install-bar">
        <span className="ib-label">Add a tool</span>
        <form onSubmit={(e) => { e.preventDefault(); installUrl(); }}>
          <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="github:owner/repo or https://github.com/owner/repo" spellCheck="false" disabled={!!busy} />
          <button className="primary sm" type="submit" disabled={!!busy}>Install</button>
          <button className="ghost sm" type="button" disabled={!!busy} onClick={() => fileRef.current && fileRef.current.click()}>Upload .zip</button>
          <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={(e) => uploadZip(e.target.files[0])} />
        </form>
      </div>
      <p className="pc-trust">Installs run the tool's code on this machine. Only install tools you trust. <a href="https://github.com/unleash-wp/wp-release-helper/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Build your own →</a></p>

      <div className="list-bar">
        <div className="seg">
          <button className={filter === 'all' ? 'on' : ''} type="button" onClick={() => setFilter('all')}>All <span>{plugins.length}</span></button>
          <button className={filter === 'inactive' ? 'on' : ''} type="button" onClick={() => setFilter('inactive')}>Inactive <span>{inactiveCount}</span></button>
        </div>
        <input className="list-search" type="text" value={iq} onChange={(e) => setIq(e.target.value)} placeholder="Search installed tools…" spellCheck="false" />
      </div>

      <div className="tool-list">
        {shown.map((p) => {
          const up = upFor(p.id);
          const active = p.enabled !== false;
          const core = p.id === 'changelog';
          return (
            <div className={'tool-row' + (active ? '' : ' is-inactive')} key={p.id}>
              <span className="tr-ic" dangerouslySetInnerHTML={{ __html: CODE_IC }} />
              <div className="tr-info">
                <div className="tr-title">
                  <h3>{p.name}</h3>
                  {core && <span className="chip">Core</span>}
                  {!active && <span className="chip chip-off">Inactive</span>}
                  {up && <a className="chip chip-up" href={up.url} target="_blank" rel="noopener">Update {up.latest}</a>}
                </div>
                <p className="tr-desc">{p.description}</p>
                <div className="tr-sub">Version {p.version} · By {p.author || 'unknown'} · {p.price === 'free' ? 'Free' : p.price}</div>
              </div>
              <div className="tr-actions">
                {active && <button className="ghost sm" type="button" onClick={() => onOpen(p.id)}>Open</button>}
                {!core && <button className="ghost sm" type="button" disabled={!!busy} onClick={() => toggle(p.id, !active)}>{active ? 'Deactivate' : 'Activate'}</button>}
                {!core && <button className="ghost sm danger" type="button" disabled={!!busy} onClick={() => remove(p.id, p.name)}>Remove</button>}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div className="tool-empty">No tools match.</div>}
      </div>
    </>
  );
}
