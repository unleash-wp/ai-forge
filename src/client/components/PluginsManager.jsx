// The visible plugin system: a polished vertical list with WordPress-style bulk
// management (checkboxes + select-all + Bulk actions + Apply, only when there is
// a non-core tool to manage) and an updater (Check for updates + per-tool
// Update). Built from the global UI components in ./ui.jsx so it stays
// consistent with the rest of Forge. Installing/updating runs the tool's code
// after a server rebuild, gated behind the user's own action + a trust note.
import { useState, useEffect, useRef } from 'react';
import { ToolIcon } from '../icons.jsx';
import { Button, Select, TextInput, Checkbox } from '../ui';

const VERB = { activate: 'Activating', deactivate: 'Deactivating', update: 'Updating', remove: 'Removing' };
const BULK_OPTIONS = [
  { value: 'activate', label: 'Activate' },
  { value: 'deactivate', label: 'Deactivate' },
  { value: 'update', label: 'Update' },
  { value: 'remove', label: 'Remove' },
];

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
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(selectableIds)); }
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
      {busy && <div className="c-warn" role="status" aria-live="polite">{busy}</div>}
      {err && <div className="c-warn c-warn--error" role="alert">{err}</div>}

      <div className="c-plugins__install">
        <span className="c-plugins__install-label">Add a tool</span>
        <form className="c-plugins__install-form" onSubmit={(e) => { e.preventDefault(); installUrl(); }}>
          <TextInput className="c-plugins__install-input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="github:owner/repo or https://github.com/owner/repo" spellCheck="false" disabled={!!busy} />
          <Button variant="primary" size="sm" type="submit" disabled={!!busy}>Install</Button>
          <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => fileRef.current && fileRef.current.click()}>Upload .zip</Button>
          <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={(e) => uploadZip(e.target.files[0])} />
        </form>
      </div>
      <p className="c-plugins__trust">Installs run the tool's code on this machine. Only install tools you trust. <a href="https://github.com/unleash-wp/wp-release-helper/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Build your own →</a></p>

      <div className="c-plugins__bar">
        <div className="c-segmented">
          <button className={'c-segmented__item' + (filter === 'all' ? ' is-active' : '')} type="button" onClick={() => setFilter('all')}>All <span className="c-segmented__count">{plugins.length}</span></button>
          <button className={'c-segmented__item' + (filter === 'inactive' ? ' is-active' : '')} type="button" onClick={() => setFilter('inactive')}>Inactive <span className="c-segmented__count">{inactiveCount}</span></button>
        </div>
        <div className="c-plugins__bar-right">
          {updMsg && <span className="c-plugins__upd-msg">{updMsg}</span>}
          <Button variant="ghost" size="sm" onClick={checkUpdates}>Check for updates</Button>
          <TextInput className="c-plugins__search" value={iq} onChange={(e) => setIq(e.target.value)} placeholder="Search installed tools…" spellCheck="false" />
        </div>
      </div>

      {selectableIds.length > 0 && (
        <div className="c-bulk">
          <label className="c-bulk__all"><Checkbox checked={allSelected} onChange={toggleAll} /> Select all</label>
          <Select value={bulk} onChange={setBulk} options={BULK_OPTIONS} placeholder="Bulk actions" ariaLabel="Bulk actions" disabled={!!busy} />
          <Button variant="ghost" size="sm" onClick={applyBulk} disabled={!bulk || !selected.size || !!busy}>Apply</Button>
          {selected.size > 0 && <span className="c-bulk__count">{selected.size} selected</span>}
        </div>
      )}

      <div className="c-plugin-list">
        {shown.map((p) => {
          const up = upFor(p.id);
          const active = p.enabled !== false;
          const core = p.id === 'changelog';
          return (
            <div className={'c-plugin-row' + (active ? '' : ' is-inactive')} key={p.id}>
              {selectableIds.length > 0 && (core
                ? <span className="c-plugin-row__cbx c-plugin-row__cbx--spacer" aria-hidden="true" />
                : <Checkbox className="c-plugin-row__cbx" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={'Select ' + p.name} />)}
              <span className="c-plugin-row__icon"><ToolIcon name={p.icon} size={20} /></span>
              <div className="c-plugin-row__info">
                <div className="c-plugin-row__title">
                  <h3 className="c-plugin-row__name">{p.name}</h3>
                  {core && <span className="c-chip">Core</span>}
                  {!active && <span className="c-chip c-chip--off">Inactive</span>}
                  {up && <span className="c-chip c-chip--up">Update available</span>}
                </div>
                <p className="c-plugin-row__desc">{p.description}</p>
                <div className="c-plugin-row__sub">Version {p.version} · By {p.author || 'unknown'} · {p.price === 'free' ? 'Free' : p.price}</div>
              </div>
              <div className="c-plugin-row__actions">
                {up && !core && <Button variant="primary" size="sm" disabled={!!busy} onClick={() => updateOne(p.id, p.name)}>Update to {up.latest}</Button>}
                {active && <Button variant="ghost" size="sm" onClick={() => onOpen(p.id)}>Open</Button>}
                {!core && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => toggle(p.id, !active)}>{active ? 'Deactivate' : 'Activate'}</Button>}
                {!core && <Button variant="ghost" size="sm" danger disabled={!!busy} onClick={() => remove(p.id, p.name)}>Remove</Button>}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div className="c-plugin-list__empty">No tools match.</div>}
      </div>
    </>
  );
}
