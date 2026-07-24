// Changelog Generator - client side of the first UnleashWP Forge tool plugin.
// Default-exports a React component that the shell mounts in <main>. It receives
// the core services (toast, openSetup) via the CoreContext. Emits the same markup
// / class names the vanilla UI did, so the existing SCSS styles it unchanged.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCore } from '../../src/client/core.jsx';
import { Button, Select, Checkbox } from '../../src/client/ui.jsx';
import { ArrowLeft, ArrowRight, CalendarIcon } from '../../src/client/icons.jsx';

const GB = 'https://github.com/WordPress/gutenberg';
const TRAC = 'https://core.trac.wordpress.org';
const CORE_GH = 'https://github.com/WordPress/wordpress-develop';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const codefmt = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

function svgIc(inner) { return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
const IC = {
  post: svgIc('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>'),
  md: svgIc('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  down: svgIc('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  link: svgIc('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  list: svgIc('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  users: svgIc('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  clip: svgIc('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  table: svgIc('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  ext: svgIc('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
};
function Ic({ html }) { return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />; }

function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoD(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fmtDay(isoStr) { const p = isoStr.split('-'); return MON[(+p[1]) - 1] + ' ' + (+p[2]); }
function fmtRange(a, b) {
  const ya = a.split('-')[0], yb = b.split('-')[0];
  return ya === yb ? fmtDay(a) + ' to ' + fmtDay(b) + ', ' + ya
                   : fmtDay(a) + ', ' + ya + ' to ' + fmtDay(b) + ', ' + yb;
}

function uniq(arr) { const seen = {}, out = []; arr.forEach((x) => { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
function sortGroups(obj, uncatLast) {
  return Object.keys(obj).map((k) => [k, obj[k]]).sort((a, b) => {
    if (uncatLast) { if (a[0] === 'Uncategorized') return 1; if (b[0] === 'Uncategorized') return -1; }
    return b[1].length - a[1].length;
  });
}
function groupHeadHtml(label, url, who) {
  const inner = url ? '<a class="grouplink" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + IC.ext + '</a>' : label;
  return '<h2>' + inner + ' <span class="who">(' + esc(who) + ')</span></h2>';
}
function gbItem(c) {
  const ref = c.pr
    ? '<a class="ref" href="' + GB + '/pull/' + c.pr + '" target="_blank" rel="noopener">#' + c.pr + '</a>'
    : (c.sha ? '<a class="ref" href="' + GB + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : '');
  return '<li>' + codefmt(c.subject) + (ref ? ' ' + ref : '') + ' <span class="who">' + esc(c.author) + '</span></li>';
}
function gbGroup(cat, items) { return '<h3 class="grp">' + esc(cat) + ' <span class="n">(' + items.length + ')</span></h3><ul class="list">' + items.map(gbItem).join('') + '</ul>'; }
function coreItem(c) {
  const ref = c.changeset
    ? '<a class="ref" href="' + TRAC + '/changeset/' + c.changeset + '" target="_blank" rel="noopener">r' + c.changeset + '</a>'
    : (c.sha ? '<a class="ref" href="' + CORE_GH + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : esc(c.shortSha));
  const tix = (c.tickets || []).map((n) => '<a class="ref" href="' + TRAC + '/ticket/' + n + '" target="_blank" rel="noopener">#' + n + '</a>').join(' ');
  const cls = c.classification ? ' <span class="tag">' + esc(c.classification) + '</span>' : '';
  const props = c.props && c.props.length ? ' <span class="who">props ' + esc(c.props.join(', ')) + '</span>' : '';
  return '<li>' + ref + ': ' + codefmt(c.subject) + cls + (tix ? ' ' + tix : '') + props + '</li>';
}
function coreGroup(comp, items) { return '<h3 class="grp">' + esc(comp) + ' <span class="n">(' + items.length + ')</span></h3><ul class="list">' + items.map(coreItem).join('') + '</ul>'; }

// Build the changelog list bodies (pure links + text, no React handlers) as HTML.
function changelogBodyHtml(data) {
  const { meta, report } = data;
  const s = data.sources || {};
  let cl = '';
  if (report.gutenberg.byCategory || report.gutenberg.commits.length) {
    cl += '<section class="group">' + groupHeadHtml('Gutenberg', s.gutenberg, meta.gbBranch);
    if (report.gutenberg.byCategory) sortGroups(report.gutenberg.byCategory).forEach((g) => { cl += gbGroup(g[0], g[1]); });
    else cl += '<ul class="list">' + report.gutenberg.commits.map(gbItem).join('') + '</ul>';
    cl += '</section>';
  }
  cl += '<section class="group">' + groupHeadHtml('Core', s.trac, meta.coreBranch);
  if (report.core.tracker) {
    cl += '<p class="note">Grouped via <code>' + esc(report.core.tracker.slug) + '</code> dev-notes tracker.</p>';
    sortGroups(report.core.byComponent, true).forEach((g) => { cl += coreGroup(g[0], g[1]); });
  } else {
    if (meta.trackerMissing) cl += '<p class="note">No dev-notes tracker for this milestone. Core stays ungrouped.</p>';
    cl += '<ul class="list">' + report.core.commits.map(coreItem).join('') + '</ul>';
  }
  cl += '</section>';
  return cl;
}

// ---- Date range picker ----
function DateRangePicker({ since, until, onChange }) {
  const today = useRef((() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()).current;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const e = until ? until.split('-') : null; return e ? new Date(+e[0], +e[1] - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1); });
  const [pendStart, setPendStart] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  });

  function close() { setOpen(false); setPendStart(null); setHoverDay(null); }
  const tISO = isoD(today);
  const nextDisabled = view.getFullYear() > today.getFullYear() || (view.getFullYear() === today.getFullYear() && view.getMonth() >= today.getMonth());

  let s, e;
  if (pendStart) {
    if (hoverDay) { s = pendStart < hoverDay ? pendStart : hoverDay; e = pendStart < hoverDay ? hoverDay : pendStart; }
    else { s = pendStart; e = null; }
  } else { s = since; e = until; }

  const startDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(<button key={'e' + i} type="button" className="cal-cell empty" tabIndex={-1} />);
  for (let day = 1; day <= days; day++) {
    const ds = view.getFullYear() + '-' + pad(view.getMonth() + 1) + '-' + pad(day);
    let cls = 'cal-cell';
    if (ds > tISO) cls += ' disabled';
    if (ds === tISO) cls += ' today';
    if (s && e) { if (ds === s) cls += ' start'; if (ds === e) cls += ' end'; if (ds > s && ds < e) cls += ' inrange'; }
    else if (s && ds === s) cls += ' start end';
    const disabled = ds > tISO;
    cells.push(
      <button key={ds} type="button" className={cls} data-d={ds}
        onClick={() => { if (disabled) return; pick(ds); }}
        onMouseOver={() => { if (!disabled && pendStart && ds !== hoverDay) setHoverDay(ds); }}>{day}</button>
    );
  }
  function pick(ds) {
    if (!pendStart) { setPendStart(ds); setHoverDay(ds); }
    else {
      let a = pendStart, b = ds; if (b < a) { const t = a; a = b; b = t; }
      onChange(a, b); setPendStart(null); setHoverDay(null); setOpen(false);
    }
  }
  function preset(n) {
    const ed = new Date(today), sd = new Date(today); sd.setDate(sd.getDate() - n);
    onChange(isoD(sd), isoD(ed)); setPendStart(null); setView(new Date(ed.getFullYear(), ed.getMonth(), 1)); setOpen(false);
  }

  return (
    <div className="rangewrap" ref={wrapRef}>
      <span className="flabel">Date range</span>
      <button type="button" className="rangebtn" aria-haspopup="true" aria-expanded={open}
        onClick={(ev) => { ev.stopPropagation(); setOpen((o) => !o); }}>
        <span>{since && until ? fmtRange(since, until) : 'Pick dates'}</span>
        <CalendarIcon size={16} className="range-cal" />
      </button>
      {open && (
        <div className="cal" onClick={(ev) => ev.stopPropagation()}>
          <div className="cal-presets">
            {[['7 days', 7], ['14 days', 14], ['30 days', 30]].map((p) => (
              <button key={p[1]} type="button" className="preset" onClick={() => preset(p[1])}>{p[0]}</button>
            ))}
          </div>
          <div className="cal-head">
            <button type="button" className="cal-nav" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ArrowLeft size={18} /></button>
            <div className="cal-title">{MON[view.getMonth()] + ' ' + view.getFullYear()}</div>
            <button type="button" className="cal-nav" aria-label="Next month" disabled={nextDisabled} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ArrowRight size={18} /></button>
          </div>
          <div className="cal-dow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
          <div className="cal-grid" onMouseLeave={() => { if (pendStart && hoverDay !== pendStart) setHoverDay(pendStart); }}>{cells}</div>
        </div>
      )}
    </div>
  );
}

// ---- Results view ----
function Results({ data, since, until }) {
  const core = useCore();
  const [tab, setTab] = useState('changelog');
  const [propsAt, setPropsAt] = useState(false);
  const meta = data.meta, report = data.report, t = report.totals;
  const issues = (t.coreTickets || 0) + (t.gutenbergPRs || 0);
  const changes = (t.gutenbergPRs || 0) + (t.coreChangesets || 0);
  const all = uniq((report.gutenberg.contributors || []).concat(report.core.contributors || []))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const dn = !!meta.devNotesOnly;
  const s = data.sources || {};

  const propsLine = all.map((n) => (propsAt ? '@' : '') + n).join(', ');
  const copy = (text, label) => { navigator.clipboard.writeText(text); core.toast(label); };
  function downloadMd() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data.markdown], { type: 'text/markdown' }));
    a.download = 'changelog.md'; a.click(); core.toast('Downloaded changelog.md');
  }
  function copyCsv() { copy(all.join('\n'), 'CSV copied'); }
  function copyPhp() {
    const arr = all.map((n) => "\t'" + String(n).replace(/'/g, "\\'") + "',");
    copy('array(\n' + arr.join('\n') + '\n)', 'PHP array copied');
  }
  const stat = (n, l) => <div className="stat" key={l}><b className="tnum">{n}</b><span>{l}</span></div>;

  return (
    <div className="results">
      <div className="rhead">
        <div className="lead-metric"><b className="tnum">{issues}</b><span>{(dn ? 'dev notes / field guide tickets, ' : 'issues addressed, ') + fmtRange(since, until)}</span></div>
        <div className="stats">
          {!dn && stat(t.gutenbergPRs, 'Gutenberg PRs')}
          {!dn && stat(t.gutenbergCommits, 'GB commits')}
          {stat(t.coreChangesets, dn ? 'Dev-note changesets' : 'Core changesets')}
          {stat(t.coreTickets, dn ? 'Dev-note tickets' : 'Core tickets')}
          {stat(t.contributors, 'Contributors')}
        </div>
      </div>

      {meta.deepError && (
        <div className="warn">Deep descriptions skipped ({esc(meta.deepError)}). Showing the cookie-free changelog. Save a fresh wordpress.org cookie in Setup for full descriptions.</div>
      )}

      <div className="tabs" role="tablist">
        <button className={'tab' + (tab === 'changelog' ? ' active' : '')} onClick={() => setTab('changelog')}><Ic html={IC.list} />Changelog<span className="cbadge">{changes}</span></button>
        <button className={'tab' + (tab === 'props' ? ' active' : '')} onClick={() => setTab('props')}><Ic html={IC.users} />Props<span className="cbadge">{all.length}</span></button>
        <div className="tabtools">
          <Button variant="ghost" size="sm" onClick={() => copy(data.post, 'Post copied')}><Ic html={IC.post} />Copy post</Button>
          <Button variant="ghost" size="sm" onClick={() => copy(data.markdown, 'Markdown copied')}><Ic html={IC.md} />Copy Markdown</Button>
          <Button variant="ghost" size="sm" onClick={downloadMd}><Ic html={IC.down} />Download</Button>
        </div>
      </div>

      <div className={'panel' + (tab === 'changelog' ? '' : ' hidden')}>
        {data.sources && (
          <section className="card sources">
            <h2>Sources <em>link these in the post so anyone can verify</em></h2>
            <SrcRow url={s.trac} text={'Closed Core Trac tickets' + (s.milestone ? ' (milestone ' + esc(s.milestone) + ')' : '') + ', ' + esc(s.since) + ' to ' + esc(s.until)} onCopy={() => copy(s.trac, 'Link copied')} />
            <SrcRow url={s.gutenberg} text={'Gutenberg commits on ' + esc(s.gbBranch) + ', ' + esc(s.since) + ' to ' + esc(s.until)} onCopy={() => copy(s.gutenberg, 'Link copied')} />
          </section>
        )}
        <div dangerouslySetInnerHTML={{ __html: changelogBodyHtml(data) }} />
        <details><summary>Post template</summary><pre>{data.post}</pre></details>
        <details><summary>Raw Markdown</summary><pre>{data.markdown}</pre></details>
      </div>

      <div className={'panel' + (tab === 'props' ? '' : ' hidden')}>
        <div className="propshead">
          <div className="props-metric"><b className="tnum">{all.length}</b><span>contributors with props this window</span></div>
          <div className="props-actions">
            <label className="atbox"><Checkbox checked={propsAt} onChange={(e) => setPropsAt(e.target.checked)} /> Add @ before names</label>
            <Button variant="ghost" size="sm" onClick={() => copy(propsLine, 'Props copied')}><Ic html={IC.clip} />Copy props line</Button>
            <Button variant="ghost" size="sm" onClick={copyCsv}><Ic html={IC.table} />CSV</Button>
            <Button variant="ghost" size="sm" onClick={copyPhp}><Ic html={IC.md} />PHP array</Button>
          </div>
        </div>
        <p className="propslist">{propsLine}</p>
        {propsAt && <p className="note props-hint">Slack handles usually match the wp.org username, but not always. Double-check before pinging.</p>}
      </div>
    </div>
  );
}
function SrcRow({ url, text, onCopy }) {
  return (
    <div className="srcrow">
      <a href={url} target="_blank" rel="noopener" dangerouslySetInnerHTML={{ __html: text }} />
      <Button variant="ghost" size="sm" onClick={onCopy}><Ic html={IC.link} />Copy link</Button>
    </div>
  );
}

// ---- The tool ----
export default function ChangelogTool() {
  const core = useCore();
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [gbBranches, setGbBranches] = useState([]);
  const [coreBranches, setCoreBranches] = useState([]);
  const [milestone, setMilestone] = useState('');
  const [gbBranch, setGbBranch] = useState('');
  const [coreBranch, setCoreBranch] = useState('trunk');
  const [loaded, setLoaded] = useState(false);
  const [labels, setLabels] = useState(true);
  const [devNotes, setDevNotes] = useState(true);
  const [devOnly, setDevOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);

  // default window: last 7 days
  useEffect(() => {
    const d = new Date(), sd = new Date(d); sd.setDate(sd.getDate() - 7);
    setSince(isoD(sd)); setUntil(isoD(d));
  }, []);

  // load branches -> milestones + branch pickers
  useEffect(() => {
    let alive = true;
    const gb = fetch('/api/branches?repo=gutenberg').then((r) => r.json()).then((d) => {
      if (!alive) return;
      const list = d.branches || [], versions = [];
      list.forEach((b) => { if (b.indexOf('wp/') === 0) { const v = b.slice(3); if (/^[0-9]+[.][0-9]+$/.test(v) && versions.indexOf(v) === -1) versions.push(v); } });
      setGbBranches(list); setMilestones(versions);
      if (versions.length) { setMilestone(versions[0]); const want = 'wp/' + versions[0]; if (list.indexOf(want) !== -1) setGbBranch(want); }
    }).catch(() => {});
    const cr = fetch('/api/branches?repo=core').then((r) => r.json()).then((d) => {
      if (alive) setCoreBranches((d.branches || []).slice(0, 80));
    }).catch(() => {});
    Promise.all([gb, cr]).then(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const onMilestone = useCallback((v) => {
    setMilestone(v);
    const want = 'wp/' + v;
    setGbBranches((list) => { if (list.indexOf(want) !== -1) setGbBranch(want); return list; });
  }, []);

  function reset() {
    const d = new Date(), sd = new Date(d); sd.setDate(sd.getDate() - 7);
    setSince(isoD(sd)); setUntil(isoD(d));
    if (milestones.length) onMilestone(milestones[0]);
    setCoreBranch('trunk'); setLabels(true); setDevNotes(true); setDevOnly(false);
    setStatus(''); setData(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!since || !until) { setStatus('Pick a date range first.'); return; }
    setBusy(true); setData(null);
    setStatus('__spin__ Fetching commits, labels and dev-notes…');
    const p = new URLSearchParams({
      since, until, milestone: milestone.trim(), gbBranch: gbBranch.trim(), coreBranch: coreBranch.trim(),
      labels, devNotes, devNotesOnly: devOnly, deep: 'true',
    });
    fetch('/api/report?' + p).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error || 'request failed'); return d; }))
      .then((d) => { setData(d); setStatus(''); })
      .catch((err) => {
        const m = err.message || 'request failed';
        if (/rate limit|\b403\b/i.test(m)) { setStatus('GitHub rate limit reached - that is the anonymous 60 requests/hour. Add a GitHub token in Setup (any account, no scopes) for 5000/hour, then try again.'); core.openSetup(); }
        else if (/cookie/i.test(m)) { setStatus('Error: ' + m); core.openSetup(); }
        else setStatus('Error: ' + m);
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
      <section className={'filters' + (loaded ? '' : ' loading')}>
        {!loaded && <div className="filters-loading"><span className="spin" /> Loading milestones and branches…</div>}
        <form className="query" onSubmit={submit}>
          <div className="qfields">
            <DateRangePicker since={since} until={until} onChange={(a, b) => { setSince(a); setUntil(b); }} />
            <label>Milestone<Select block searchable value={milestone} onChange={onMilestone} options={milestones.map((v) => ({ value: v, label: v }))} placeholder="—" /></label>
            <label>Gutenberg branch<Select block searchable value={gbBranch} onChange={setGbBranch} options={gbBranches.map((b) => ({ value: b, label: b }))} placeholder="—" /></label>
            <label>Core branch<Select block searchable value={coreBranch} onChange={setCoreBranch} options={coreBranches.map((b) => ({ value: b, label: b }))} placeholder="—" /></label>
          </div>
          <div className="qactions">
            <div className="checks">
              <label><Checkbox checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Group Gutenberg <span className="info" data-tip="Group Gutenberg changes by label (Bug, Feature). Off shows one flat list." onClick={(e) => e.preventDefault()}>i</span></label>
              <label><Checkbox checked={devNotes} onChange={(e) => setDevNotes(e.target.checked)} /> Group Core <span className="info" data-tip="Group Core changes by component (Editor, REST API). Off shows one flat list." onClick={(e) => e.preventDefault()}>i</span></label>
              <label><Checkbox checked={devOnly} onChange={(e) => setDevOnly(e.target.checked)} /> Dev notes only <span className="info" data-tip="Keep only Core tickets flagged dev-note / misc-dev-note / field-guide in the docs tracker. Perfect for Field Guide prep." onClick={(e) => e.preventDefault()}>i</span></label>
            </div>
            <div className="go"><button className="reset-link" type="button" onClick={reset}>Reset</button><Button variant="primary" type="submit" disabled={busy}>Generate</Button></div>
          </div>
        </form>
      </section>

      {status && <div id="status">{status.startsWith('__spin__') ? <><span className="spin" /> {status.slice(8)}</> : status}</div>}

      {data ? <Results data={data} since={since} until={until} />
        : (!status && (
          <div className="results"><div className="empty"><img src="/brand/bulb.svg" alt="" /><h3>No changelog yet</h3>
            <p>Pick a date range and a milestone, then Generate. You get the counts, the source links, the grouped changelog, and the props.</p></div></div>
        ))}
    </>
  );
}
