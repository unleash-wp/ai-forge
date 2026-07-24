// The visible plugin system, laid out like the WordPress plugins admin table:
// a vertical table (Plugin | Description columns), not a card grid. Name in bold
// with action links beneath (Open / Activate|Deactivate / Remove); inactive rows
// grey out; an "All | Inactive" filter + a search box; version + author meta.
//  - Installed: an install bar (GitHub URL / .zip) + the installed tools table.
//  - Marketplace: curated verified tools as a table with a search box + Install.
// Installing runs the tool's code after a server-side rebuild (gated behind the
// user's own action + trust note). Activate/deactivate is instant (no rebuild).
import { useState, useEffect, useRef } from 'react';

export default function PluginsManager({ plugins, onOpen, onChanged }) {
  const [tab, setTab] = useState('installed');
  const [updates, setUpdates] = useState([]);
  const [market, setMarket] = useState(null); // null = loading
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');       // marketplace search
  const [iq, setIq] = useState('');     // installed search
  const [filter, setFilter] = useState('all'); // all | inactive
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/updates').then((r) => r.json()).then((d) => setUpdates(d.updates || [])).catch(() => {});
    fetch('/api/marketplace').then((r) => r.json()).then((d) => setMarket(d.tools || [])).catch(() => setMarket([]));
  }, []);
  const upFor = (id) => updates.find((u) => u.id === id);
  const installedIds = new Set(plugins.map((p) => p.id));
  const inactiveCount = plugins.filter((p) => p.enabled === false).length;

  function afterInstall(label, promise) {
    setErr(''); setBusy(label);
    promise
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setBusy('Done. Reloading…'); window.location.reload(); } else { setBusy(''); setErr(d.error || 'failed'); } })
      .catch(() => { setBusy(''); setErr('request failed'); });
  }
  const installSource = (s, what) => afterInstall('Installing ' + what + '… building the bundle, then the page reloads.',
    fetch('/api/plugins/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: s }) }));
  function installUrl() {
    const s = source.trim();
    if (!s) { setErr('Paste a GitHub repo URL first.'); return; }
    installSource(s, 'from ' + s);
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

  const installedShown = plugins
    .filter((p) => (filter === 'inactive' ? p.enabled === false : true))
    .filter((p) => (p.name + ' ' + (p.description || '')).toLowerCase().includes(iq.trim().toLowerCase()));

  return (
    <>
      {busy && <div className="warn">{busy}</div>}
      {err && <div className="warn bad-note">{err}</div>}

      <div className="tabs" role="tablist">
        <button className={'tab' + (tab === 'installed' ? ' active' : '')} onClick={() => setTab('installed')}>Installed<span className="cbadge">{plugins.length}</span></button>
        <button className={'tab' + (tab === 'market' ? ' active' : '')} onClick={() => setTab('market')}>Marketplace{market ? <span className="cbadge">{market.length}</span> : null}</button>
      </div>

      {tab === 'installed' ? (
        <>
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

          <div className="pt-bar">
            <div className="pt-filters">
              <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>All <span className="c">({plugins.length})</span></button>
              <span className="sep">|</span>
              <button className={filter === 'inactive' ? 'active' : ''} type="button" onClick={() => setFilter('inactive')}>Inactive <span className="c">({inactiveCount})</span></button>
            </div>
            <div className="pt-search"><input type="text" value={iq} onChange={(e) => setIq(e.target.value)} placeholder="Search installed tools…" spellCheck="false" /></div>
          </div>

          <div className="plugin-table">
            <div className="pt-head"><span>Plugin</span><span>Description</span></div>
            {installedShown.map((p) => {
              const up = upFor(p.id);
              const active = p.enabled !== false;
              const core = p.id === 'changelog';
              return (
                <div className={'pt-row' + (active ? '' : ' is-inactive')} key={p.id}>
                  <div className="pt-name">
                    <h3>{p.name}</h3>
                    <div className="row-actions">
                      {active && <button className="linkbtn" type="button" onClick={() => onOpen(p.id)}>Open</button>}
                      {!core && <button className="linkbtn" type="button" disabled={!!busy} onClick={() => toggle(p.id, !active)}>{active ? 'Deactivate' : 'Activate'}</button>}
                      {!core && <button className="linkbtn danger" type="button" disabled={!!busy} onClick={() => remove(p.id, p.name)}>Remove</button>}
                      {core && <span className="row-note">Core tool</span>}
                    </div>
                  </div>
                  <div className="pt-desc">
                    <p>{p.description}</p>
                    <div className="pt-meta">
                      {!active && <span className="badge-off">Inactive</span>}
                      {up && <a className="badge-up" href={up.url} target="_blank" rel="noopener">Update → {up.latest}</a>}
                      <span>Version {p.version} | By {p.author || 'unknown'} | {p.price === 'free' ? 'Free' : p.price}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {installedShown.length === 0 && <div className="pt-row"><div className="pt-name" /><div className="pt-desc"><p>No tools match.</p></div></div>}
          </div>
        </>
      ) : (
        <>
          <p className="note market-note">Curated and verified by UnleashWP. One-click install runs the same builder as a manual install.</p>
          <div className="market-search">
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…" spellCheck="false" />
          </div>
          {(() => {
            if (market === null) return <div className="empty"><p>Loading the marketplace…</p></div>;
            const shown = market.filter((t) => (t.name + ' ' + t.description).toLowerCase().includes(q.trim().toLowerCase()));
            if (market.length === 0) return <div className="empty"><h3>No verified tools published yet</h3><p>The registry is brand new. <a href="https://github.com/unleash-wp/wp-release-helper/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Build the first one →</a></p></div>;
            if (shown.length === 0) return <div className="empty"><p>No tools match "{q}".</p></div>;
            return (
              <div className="plugin-table">
                <div className="pt-head"><span>Tool</span><span>Description</span></div>
                {shown.map((t) => {
                  const installed = installedIds.has(t.id);
                  return (
                    <div className="pt-row" key={t.id}>
                      <div className="pt-name">
                        <h3>{t.name}</h3>
                        <div className="row-actions">
                          {installed ? <span className="row-note">Installed</span>
                            : t.source === 'core' ? <span className="row-note">Core</span>
                            : <button className="linkbtn" type="button" disabled={!!busy} onClick={() => installSource(t.source, t.name)}>Install</button>}
                        </div>
                      </div>
                      <div className="pt-desc">
                        <p>{t.description}</p>
                        <div className="pt-meta">
                          {t.verified && <span className="badge-verified">✓ Verified</span>}
                          <span>Version {t.version} | By {t.author || 'unknown'} | {t.price === 'free' ? 'Free' : t.price}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
