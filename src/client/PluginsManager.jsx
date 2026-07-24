// The visible plugin system: a polished vertical list with WordPress-style bulk
// management (checkboxes + select-all + a Bulk actions dropdown + Apply) and an
// updater (Check for updates + per-tool Update). Lifecycle: install (GitHub URL
// / .zip), activate/deactivate (instant), update (reinstall latest from source),
// remove. Installing/updating runs the tool's code after a server rebuild, gated
// behind the user's own action + a trust note.
import { useState, useEffect, useRef } from 'react';
import { ToolIcon } from './icons.jsx';

const VERB = { activate: 'Activating', deactivate: 'Deactivating', update: 'Updating', remove: 'Removing' };

export default function PluginsManager({ plugins, onOpen, onChanged }) {
  const [updates, setUpdates] = useState([]);
  const [source, setSource] = useState('');
  const [iq, setIq] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [bulk, setBulk] = useState('');
  const [updMsg, setUpdMsg] = useState('');
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
  function updateOne(id, name) {
    afterInstall('Updating ' + name + '… downloading + rebuilding.',
      fetch('/api/plugins/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', ids: [id] }) }));
  }
  function checkUpdates() {
    setUpdMsg('Checking…');
    fetch('/api/updates').then((r) => r.json()).then((d) => {
      const list = d.updates || [];
      setUpdates(list);
      setUpdMsg(list.length ? list.length + ' update' + (list.length > 1 ? 's' : '') + ' available' : 'All tools are up to date.');
    }).catch(() => setUpdMsg('Update check failed.'));
  }

  const shown = plugins
    .filter((p) => (filter === 'inactive' ? p.enabled === false : true))
    .filter((p) => (p.name + ' ' + (p.description || '')).toLowerCase().includes(iq.trim().toLowerCase()));
  const selectableIds = shown.filter((p) => p.id !== 'changelog').map((p) => p.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }
  function applyBulk() {
    const ids = [...selected];
    if (!bulk || !ids.length) return;
    if (bulk === 'remove' && !window.confirm('Remove ' + ids.length + ' tool(s)? This deletes them and rebuilds.')) return;
    setErr(''); setBusy(VERB[bulk] + ' ' + ids.length + ' tool(s)…');
    fetch('/api/plugins/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: bulk, ids }) })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setBusy(''); setErr(d.error || 'failed'); return; }
        if (d.errors && d.errors.length) setErr(d.errors.join(' · '));
        if (d.rebuilt) { setBusy('Done. Reloading…'); window.location.reload(); }
        else { setBusy(''); setSelected(new Set()); setBulk(''); if (onChanged) onChanged(); }
      })
      .catch(() => { setBusy(''); setErr('request failed'); });
  }

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
        <div className="list-bar-right">
          {updMsg && <span className="upd-msg">{updMsg}</span>}
          <button className="ghost sm" type="button" onClick={checkUpdates}>Check for updates</button>
          <input className="list-search" type="text" value={iq} onChange={(e) => setIq(e.target.value)} placeholder="Search installed tools…" spellCheck="false" />
        </div>
      </div>

      {selectableIds.length > 0 && (
        <div className="bulk-bar">
          <label className="bulk-all"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all</label>
          <select value={bulk} onChange={(e) => setBulk(e.target.value)} disabled={!!busy}>
            <option value="">Bulk actions</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="update">Update</option>
            <option value="remove">Remove</option>
          </select>
          <button className="ghost sm" type="button" onClick={applyBulk} disabled={!bulk || !selected.size || !!busy}>Apply</button>
          {selected.size > 0 && <span className="bulk-n">{selected.size} selected</span>}
        </div>
      )}

      <div className="tool-list">
        {shown.map((p) => {
          const up = upFor(p.id);
          const active = p.enabled !== false;
          const core = p.id === 'changelog';
          return (
            <div className={'tool-row' + (active ? '' : ' is-inactive')} key={p.id}>
              {selectableIds.length > 0 && (core
                ? <span className="tr-cbx tr-cbx-spacer" aria-hidden="true" />
                : <input type="checkbox" className="tr-cbx" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={'Select ' + p.name} />)}
              <span className="tr-ic"><ToolIcon name={p.icon} size={20} /></span>
              <div className="tr-info">
                <div className="tr-title">
                  <h3>{p.name}</h3>
                  {core && <span className="chip">Core</span>}
                  {!active && <span className="chip chip-off">Inactive</span>}
                  {up && <span className="chip chip-up">Update available</span>}
                </div>
                <p className="tr-desc">{p.description}</p>
                <div className="tr-sub">Version {p.version} · By {p.author || 'unknown'} · {p.price === 'free' ? 'Free' : p.price}</div>
              </div>
              <div className="tr-actions">
                {up && !core && <button className="primary sm" type="button" disabled={!!busy} onClick={() => updateOne(p.id, p.name)}>Update to {up.latest}</button>}
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
