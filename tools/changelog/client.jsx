// Changelog Generator - client side of the first UnleashWP Forge tool plugin.
// Default-exports a React component that the shell mounts in <main>. It receives
// the core services (toast, openSetup) via the CoreContext. BEM classes (c-*)
// are styled by this tool's co-located ./client.scss (bundled into main.css).
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCore } from '../../src/client/core.jsx';
import { Button, Select, Checkbox } from '../../src/client/ui';
import { ArrowLeft, ArrowRight, CalendarIcon } from '../../src/client/icons.jsx';
import './client.scss'; // this tool's co-located styles (bundled into main.css)

const GB = 'https://github.com/WordPress/gutenberg';
const TRAC = 'https://core.trac.wordpress.org';
const CORE_GH = 'https://github.com/WordPress/wordpress-develop';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const codefmt = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

// Contributor hygiene: strip any leading @ so names are clean by default (the
// "Add @" toggle re-adds it), and drop automation accounts (github-actions[bot],
// *-bot, dependabot, renovate, …) so props credit only real people.
const cleanName = (n) => String(n).replace(/^@+/, '').trim();
const isBot = (n) => /\[bot\]|(^|[^a-z])bot([^a-z]|$)|dependabot|renovate|greenkeeper|codecov|imgbot/i.test(String(n));

function svgIc(inner) { return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
const IC = {
  md: svgIc('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  down: svgIc('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  link: svgIc('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
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
  const inner = url ? '<a class="c-changelog-group__link" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + IC.ext + '</a>' : label;
  return '<h2 class="c-changelog-group__title">' + inner + ' <span class="c-byline">(' + esc(who) + ')</span></h2>';
}
function gbItem(c) {
  const ref = c.pr
    ? '<a class="c-ref" href="' + GB + '/pull/' + c.pr + '" target="_blank" rel="noopener">#' + c.pr + '</a>'
    : (c.sha ? '<a class="c-ref" href="' + GB + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : '');
  return '<li class="c-changelog-list__item">' + (ref ? ref + ' ' : '') + codefmt(c.subject) + ' <span class="c-byline">by ' + esc(c.author) + '</span></li>';
}
function gbGroup(cat, items) { return '<h3 class="c-changelog-group__subhead">' + esc(cat) + ' <span class="c-changelog-group__count">(' + items.length + ')</span></h3><ul class="c-changelog-list">' + items.map(gbItem).join('') + '</ul>'; }
function coreItem(c) {
  const ref = c.changeset
    ? '<a class="c-ref" href="' + TRAC + '/changeset/' + c.changeset + '" target="_blank" rel="noopener">r' + c.changeset + '</a>'
    : (c.sha ? '<a class="c-ref" href="' + CORE_GH + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : esc(c.shortSha));
  const tix = (c.tickets || []).map((n) => '<a class="c-ref" href="' + TRAC + '/ticket/' + n + '" target="_blank" rel="noopener">#' + n + '</a>').join(' ');
  const cls = c.classification ? ' <span class="c-tag">' + esc(c.classification) + '</span>' : '';
  const props = c.props && c.props.length ? ' <span class="c-byline">by ' + esc(c.props.join(', ')) + '</span>' : '';
  const desc = c.description ? '<div class="c-desc">' + codefmt(c.description.replace(/\s+/g, ' ').trim()) + '</div>' : '';
  return '<li class="c-changelog-list__item">' + ref + ' ' + codefmt(c.subject) + cls + (tix ? ' ' + tix : '') + props + desc + '</li>';
}
function coreGroup(comp, items) { return '<h3 class="c-changelog-group__subhead">' + esc(comp) + ' <span class="c-changelog-group__count">(' + items.length + ')</span></h3><ul class="c-changelog-list">' + items.map(coreItem).join('') + '</ul>'; }

// Build the changelog list bodies (pure links + text, no React handlers) as HTML.
function changelogBodyHtml(data) {
  const { meta, report } = data;
  const s = data.sources || {};
  let cl = '';
  if (report.gutenberg.byCategory || report.gutenberg.commits.length) {
    cl += '<section class="c-changelog-group">' + groupHeadHtml('Gutenberg', s.gutenberg, meta.gbBranch);
    if (report.gutenberg.byCategory) sortGroups(report.gutenberg.byCategory).forEach((g) => { cl += gbGroup(g[0], g[1]); });
    else cl += '<ul class="c-changelog-list">' + report.gutenberg.commits.map(gbItem).join('') + '</ul>';
    cl += '</section>';
  }
  cl += '<section class="c-changelog-group">' + groupHeadHtml('Core', s.trac, meta.coreBranch);
  if (report.core.tracker) {
    cl += '<p class="u-note">Grouped via <code>' + esc(report.core.tracker.slug) + '</code> dev-notes tracker.</p>';
    sortGroups(report.core.byComponent, true).forEach((g) => { cl += coreGroup(g[0], g[1]); });
  } else {
    if (meta.trackerMissing) cl += '<p class="u-note">No dev-notes tracker for this milestone. Core stays ungrouped.</p>';
    cl += '<ul class="c-changelog-list">' + report.core.commits.map(coreItem).join('') + '</ul>';
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
  }, [open]);

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
  for (let i = 0; i < startDow; i++) cells.push(<button key={'e' + i} type="button" className="c-calendar__cell is-empty" tabIndex={-1} />);
  for (let day = 1; day <= days; day++) {
    const ds = view.getFullYear() + '-' + pad(view.getMonth() + 1) + '-' + pad(day);
    let cls = 'c-calendar__cell';
    if (ds > tISO) cls += ' is-disabled';
    if (ds === tISO) cls += ' is-today';
    if (s && e) { if (ds === s) cls += ' is-start'; if (ds === e) cls += ' is-end'; if (ds > s && ds < e) cls += ' is-inrange'; }
    else if (s && ds === s) cls += ' is-start is-end';
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
    <div className="c-daterange" ref={wrapRef}>
      <span className="c-daterange__label">Date range</span>
      <button type="button" className="c-daterange__button" aria-haspopup="true" aria-expanded={open}
        onClick={(ev) => { ev.stopPropagation(); setOpen((o) => !o); }}>
        <span>{since && until ? fmtRange(since, until) : 'Pick dates'}</span>
        <CalendarIcon size={16} className="c-daterange__cal-icon" />
      </button>
      {open && (
        <div className="c-calendar" onClick={(ev) => ev.stopPropagation()}>
          <div className="c-calendar__presets">
            {[['7 days', 7], ['14 days', 14], ['30 days', 30]].map((p) => (
              <button key={p[1]} type="button" className="c-calendar__preset" onClick={() => preset(p[1])}>{p[0]}</button>
            ))}
          </div>
          <div className="c-calendar__head">
            <button type="button" className="c-calendar__nav" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ArrowLeft size={18} /></button>
            <div className="c-calendar__title">{MON[view.getMonth()] + ' ' + view.getFullYear()}</div>
            <button type="button" className="c-calendar__nav" aria-label="Next month" disabled={nextDisabled} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ArrowRight size={18} /></button>
          </div>
          <div className="c-calendar__dow"><span className="c-calendar__dow-day">Su</span><span className="c-calendar__dow-day">Mo</span><span className="c-calendar__dow-day">Tu</span><span className="c-calendar__dow-day">We</span><span className="c-calendar__dow-day">Th</span><span className="c-calendar__dow-day">Fr</span><span className="c-calendar__dow-day">Sa</span></div>
          <div className="c-calendar__grid" onMouseLeave={() => { if (pendStart && hoverDay !== pendStart) setHoverDay(pendStart); }}>{cells}</div>
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
  const [devNotes, setDevNotes] = useState(null);
  const meta = data.meta, report = data.report, t = report.totals;
  useEffect(() => {
    if (!meta.milestone) { setDevNotes([]); return; }
    fetch('/api/devnotes?milestone=' + encodeURIComponent(meta.milestone))
      .then((r) => r.json()).then((d) => setDevNotes(d.notes || [])).catch(() => setDevNotes([]));
  }, [meta.milestone]);
  const issues = (t.coreTickets || 0) + (t.gutenbergPRs || 0);
  const changes = (t.gutenbergCommits || 0) + (t.coreChangesets || 0);
  // Core-tickets card: prefer the Trac milestone count (matches the Sources
  // "Closed Core Trac tickets" link exactly) when the server could fetch it with
  // a saved cookie; otherwise the cookie-free count of tickets the in-window
  // changesets close.
  const coreTicketsShown = report.core.tracTicketCount != null ? report.core.tracTicketCount : (t.coreTickets || 0);
  // Contributor list is pure over the report; memoize so tab switches and the
  // "Add @" toggle don't re-run the clean/bot-filter/sort every render.
  const all = useMemo(() => uniq((report.gutenberg.contributors || []).concat(report.core.contributors || [])
    .map(cleanName).filter((n) => n && !isBot(n)))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())), [report]);
  const dn = !!meta.devNotesOnly;
  const s = data.sources || {};
  // The changelog body is a big HTML string (hundreds of <li>). Rebuild it only
  // when the data changes, not on every tab/@-toggle/dev-notes re-render.
  const bodyHtml = useMemo(() => changelogBodyHtml(data), [data]);

  // @ is off by default and controlled by the toggle for both the view and every export.
  const withAt = (n) => (propsAt ? '@' : '') + n;
  const propsLine = all.map(withAt).join(', ');
  const copy = (text, label) => { navigator.clipboard.writeText(text); core.toast(label); };
  function downloadMd() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data.markdown], { type: 'text/markdown' }));
    a.download = 'changelog.md'; a.click(); core.toast('Downloaded changelog.md');
  }
  function copyCsv() { copy(all.map(withAt).join('\n'), 'CSV copied'); }
  function copyPhp() {
    const arr = all.map((n) => "\t'" + withAt(n).replace(/'/g, "\\'") + "',");
    copy('array(\n' + arr.join('\n') + '\n)', 'PHP array copied');
  }
  const stat = (n, l, counted) => <div className={'c-stat' + (counted ? ' c-stat--counted' : '')} key={l}><b className="c-stat__value u-tnum">{n}</b><span className="c-stat__label">{l}</span>{counted && <span className="c-stat__tag">in total</span>}</div>;

  return (
    <div className="c-results">
      <div className="c-results__head">
        <div className="c-lead-metric"><b className="c-lead-metric__value u-tnum">{dn ? issues : changes}</b><span className="c-lead-metric__text">{(dn ? 'dev notes / field guide tickets, ' : 'changes landed across Core and Gutenberg, ') + fmtRange(since, until)}{!dn && <button type="button" className="c-info" data-tip={t.gutenbergCommits + ' Gutenberg changes + ' + t.coreChangesets + ' Core changesets'} aria-label={t.gutenbergCommits + ' Gutenberg changes plus ' + t.coreChangesets + ' Core changesets'} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>i</button>}</span></div>
        <div className="c-stats">
          {!dn && stat(t.gutenbergCommits, 'Gutenberg changes', true)}
          {stat(t.coreChangesets, dn ? 'Dev-note changesets' : 'Core changesets', !dn)}
          {stat(coreTicketsShown, dn ? 'Dev-note tickets' : 'Core tickets', dn)}
          {stat(all.length, 'Contributors')}
        </div>
      </div>

      {meta.deepError && (
        <div className="c-warn">MCP enrichment skipped ({esc(meta.deepError)}). Descriptions still show, sourced from the GitHub commit bodies.</div>
      )}

      <div className="c-tabs" role="tablist">
        <button className={'c-tab' + (tab === 'changelog' ? ' is-active' : '')} onClick={() => setTab('changelog')}>Changelog<span className="c-tab__badge">{changes}</span></button>
        <button className={'c-tab' + (tab === 'props' ? ' is-active' : '')} onClick={() => setTab('props')}>Props<span className="c-tab__badge">{all.length}</span></button>
        <button className={'c-tab' + (tab === 'devnotes' ? ' is-active' : '')} onClick={() => setTab('devnotes')}>Dev Notes{devNotes ? <span className="c-tab__badge">{devNotes.length}</span> : null}</button>
        <div className="c-tabs__tools">
          <Button variant="ghost" size="sm" onClick={() => copy(data.markdown, 'Markdown copied')}><Ic html={IC.md} />Copy Markdown</Button>
          <Button variant="ghost" size="sm" onClick={downloadMd}><Ic html={IC.down} />Download</Button>
        </div>
      </div>

      <div className={'c-panel' + (tab === 'changelog' ? '' : ' is-hidden')}>
        {data.sources && (
          <section className="c-card c-sources">
            <h2 className="c-sources__title">Sources <em className="c-sources__title-hint">link these in the post so anyone can verify</em></h2>
            <SrcRow url={s.trac} text={'Closed Core Trac tickets' + (s.milestone ? ' (milestone ' + esc(s.milestone) + ')' : '') + ', ' + esc(s.since) + ' to ' + esc(s.until)} onCopy={() => copy(s.trac, 'Link copied')} />
            <SrcRow url={s.gutenberg} text={'Gutenberg commits on ' + esc(s.gbBranch) + ', ' + esc(s.since) + ' to ' + esc(s.until)} onCopy={() => copy(s.gutenberg, 'Link copied')} />
          </section>
        )}
        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        <details><summary>Raw Markdown</summary><pre>{data.markdown}</pre></details>
      </div>

      <div className={'c-panel' + (tab === 'props' ? '' : ' is-hidden')}>
        <div className="c-props__head">
          <div className="c-props-metric"><b className="c-props-metric__value u-tnum">{all.length}</b><span className="c-props-metric__text">contributors with props this window</span></div>
          <div className="c-props__actions">
            <label className="c-props__at"><Checkbox checked={propsAt} onChange={(e) => setPropsAt(e.target.checked)} /> Add @ before names</label>
            <Button variant="ghost" size="sm" onClick={() => copy(propsLine, 'Props copied')}><Ic html={IC.clip} />Copy props line</Button>
            <Button variant="ghost" size="sm" onClick={copyCsv}><Ic html={IC.table} />CSV</Button>
            <Button variant="ghost" size="sm" onClick={copyPhp}><Ic html={IC.md} />PHP array</Button>
          </div>
        </div>
        <p className="c-props__list">{propsLine}</p>
        {propsAt && <p className="u-note c-props__hint">Slack handles usually match the wp.org username, but not always. Double-check before pinging.</p>}
      </div>

      <div className={'c-panel' + (tab === 'devnotes' ? '' : ' is-hidden')}>
        <p className="u-note">Published dev notes for {meta.milestone ? <b>{meta.milestone}</b> : 'this milestone'}, from <a href={'https://make.wordpress.org/core/tag/dev-notes-' + String(meta.milestone || '').replace(/\./g, '-') + '/'} target="_blank" rel="noopener">make.wordpress.org/core</a> (the tagged Field Guide source).</p>
        {devNotes === null ? <p className="u-note"><span className="u-spin" /> Loading dev notes…</p>
          : devNotes.length === 0 ? <div className="c-empty"><h3 className="c-empty__title">No dev notes yet</h3><p className="c-empty__text">make.wordpress.org has no <code>dev-notes-{String(meta.milestone || '').replace(/\./g, '-')}</code> posts yet. They land as the release nears.</p></div>
          : <ul className="c-devnotes">{devNotes.map((n, i) => (
              <li key={i} className="c-devnotes__item">
                <a className="c-devnotes__link" href={n.url} target="_blank" rel="noopener">{n.title}</a>
                <span className="c-devnotes__date">{n.date}</span>
                {n.excerpt && <p className="c-devnotes__excerpt">{n.excerpt}…</p>}
              </li>
            ))}</ul>}
      </div>
    </div>
  );
}
function SrcRow({ url, text, onCopy }) {
  return (
    <div className="c-sources__row">
      <a className="c-sources__link" href={url} target="_blank" rel="noopener" dangerouslySetInnerHTML={{ __html: text }} />
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
  const [full, setFull] = useState(false);
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
    setCoreBranch('trunk'); setLabels(true); setDevNotes(true); setDevOnly(false); setFull(false);
    setStatus(''); setData(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!since || !until) { setStatus('Pick a date range first.'); return; }
    setBusy(true); setData(null);
    setStatus('__spin__ Fetching commits, labels and dev-notes…');
    const p = new URLSearchParams({
      since, until, milestone: milestone.trim(), gbBranch: gbBranch.trim(), coreBranch: coreBranch.trim(),
      labels, devNotes, devNotesOnly: devOnly, deep: full,
    });
    fetch('/api/report?' + p).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error || 'request failed'); return d; }))
      .then((d) => { setData(d); setStatus(''); })
      .catch((err) => {
        const m = err.message || 'request failed';
        if (/rate limit|\b403\b/i.test(m)) { setStatus('GitHub rate limit reached. That is the anonymous 60 requests/hour. Add a GitHub token in Setup (any account, no scopes) for 5000/hour, then try again.'); core.openSetup(); }
        else if (/cookie/i.test(m)) { setStatus('Error: ' + m); core.openSetup(); }
        else setStatus('Error: ' + m);
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
      <section className={'c-filters' + (loaded ? '' : ' is-loading')}>
        {!loaded && <div className="c-filters__loading"><span className="u-spin" /> Loading milestones and branches…</div>}
        <form className="c-query" onSubmit={submit}>
          <div className="c-query__fields">
            <DateRangePicker since={since} until={until} onChange={(a, b) => { setSince(a); setUntil(b); }} />
            <label className="c-query__field">Milestone<Select block searchable ariaLabel="Milestone" value={milestone} onChange={onMilestone} options={milestones.map((v) => ({ value: v, label: v }))} placeholder="Select" /></label>
            <label className="c-query__field">Gutenberg branch<Select block searchable ariaLabel="Gutenberg branch" value={gbBranch} onChange={setGbBranch} options={gbBranches.map((b) => ({ value: b, label: b }))} placeholder="Select" /></label>
            <label className="c-query__field">Core branch<Select block searchable ariaLabel="Core branch" value={coreBranch} onChange={setCoreBranch} options={coreBranches.map((b) => ({ value: b, label: b }))} placeholder="Select" /></label>
          </div>
          <div className="c-query__actions">
            <div className="c-query__checks">
              <label className="c-query__check"><Checkbox checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Group Gutenberg <button type="button" className="c-info" data-tip="Group Gutenberg changes by label (Bug, Feature). Off shows one flat list." aria-label="Group Gutenberg changes by label (Bug, Feature). Off shows one flat list." onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>i</button></label>
              <label className="c-query__check"><Checkbox checked={devNotes} onChange={(e) => setDevNotes(e.target.checked)} /> Group Core <button type="button" className="c-info" data-tip="Group Core changes by component (Editor, REST API). Off shows one flat list." aria-label="Group Core changes by component (Editor, REST API). Off shows one flat list." onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>i</button></label>
              <label className="c-query__check"><Checkbox checked={devOnly} onChange={(e) => setDevOnly(e.target.checked)} /> Dev notes only <button type="button" className="c-info" data-tip="Keep only Core tickets flagged dev-note / misc-dev-note / field-guide in the docs tracker. Perfect for Field Guide prep." aria-label="Keep only Core tickets flagged dev-note / misc-dev-note / field-guide in the docs tracker. Perfect for Field Guide prep." onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>i</button></label>
              <label className="c-query__check"><Checkbox checked={full} onChange={(e) => setFull(e.target.checked)} /> Full descriptions <button type="button" className="c-info" data-tip="Show each Core change's full description from its GitHub commit body (cookie-free). The Automattic MCP enriches it with Trac ticket detail when available. Off = fast." aria-label="Show each Core change's full description from its GitHub commit body (cookie-free). The Automattic MCP enriches it with Trac ticket detail when available. Off = fast." onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>i</button></label>
            </div>
            <div className="c-query__go"><button className="c-query__reset" type="button" onClick={reset}>Reset</button><Button variant="primary" type="submit" disabled={busy}>Generate</Button></div>
          </div>
        </form>
      </section>

      {status && <div className="c-status" role="status" aria-live="polite">{status.startsWith('__spin__') ? <><span className="u-spin" /> {status.slice(8)}</> : status}</div>}

      {data ? <Results data={data} since={since} until={until} />
        : (!status && (
          <div className="c-results"><div className="c-empty"><img className="c-empty__icon" src="/brand/bulb.svg" alt="" /><h3 className="c-empty__title">No changelog yet</h3>
            <p className="c-empty__text">Pick a date range and a milestone, then Generate. You get the counts, the source links, the grouped changelog, and the props.</p></div></div>
        ))}
    </>
  );
}
