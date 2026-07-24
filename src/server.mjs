import { createServer } from 'node:http';
import { generate } from './report.mjs';
import { toMarkdown } from './format.mjs';
import { authenticated } from './github.mjs';

export function startServer({ port = 4321 } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }

    if (url.pathname === '/api/report') {
      try {
        const q = url.searchParams;
        const { meta, report } = await generate({
          since: q.get('since'),
          until: q.get('until'),
          milestone: q.get('milestone') || null,
          gbBranch: q.get('gbBranch') || undefined,
          coreBranch: q.get('coreBranch') || undefined,
          labels: q.get('labels') !== 'false',
          devNotes: q.get('devNotes') !== 'false',
        });
        const markdown = toMarkdown(report, meta);
        json(res, 200, { meta, report, markdown });
      } catch (err) {
        json(res, 400, { error: err.message });
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`uwp: port ${port} is already in use — try \`uwp serve --port ${port + 1}\`.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, () => {
    console.log(`uwp browser UI  ->  http://localhost:${port}`);
    if (!authenticated) console.log('uwp: no gh token — GitHub API limited to 60 req/h.');
    console.log('Press Ctrl+C to stop.');
  });
  return server;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>uwp — WordPress release changelog</title>
<style>
  :root {
    --bg: #ffffff; --fg: #1a1a1a; --muted: #666; --line: #e3e3e3;
    --card: #f7f7f8; --accent: #3858e9; --tag: #eef1fe; --tagfg: #3858e9;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #16171a; --fg: #e8e8ea; --muted: #9aa0a6; --line: #2c2e33;
      --card: #1e2024; --accent: #7f9cff; --tag: #24304f; --tagfg: #b9c7ff; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--fg); }
  header { padding: 22px 20px; border-bottom: 1px solid var(--line); }
  h1 { margin: 0; font-size: 19px; }
  h1 small { color: var(--muted); font-weight: 400; font-size: 13px; margin-left: 8px; }
  main { max-width: 1000px; margin: 0 auto; padding: 20px; }
  form { display: flex; flex-wrap: wrap; gap: 14px; align-items: end;
    background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  input[type=date], input[type=text] { font: inherit; padding: 7px 9px; border: 1px solid var(--line);
    border-radius: 8px; background: var(--bg); color: var(--fg); }
  .checks { display: flex; gap: 14px; align-items: center; font-size: 13px; color: var(--fg); }
  .checks label { flex-direction: row; align-items: center; gap: 5px; color: var(--fg); }
  button { font: inherit; font-weight: 600; padding: 9px 18px; border: 0; border-radius: 8px;
    background: var(--accent); color: #fff; cursor: pointer; }
  button:disabled { opacity: .55; cursor: default; }
  button.ghost { background: transparent; color: var(--accent); border: 1px solid var(--line); }
  #status { margin: 18px 2px; color: var(--muted); min-height: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 18px 0; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .stat b { display: block; font-size: 24px; }
  .stat span { color: var(--muted); font-size: 12px; }
  section.group { margin: 26px 0 8px; }
  h2 { font-size: 16px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
  h3 { font-size: 14px; margin: 18px 0 6px; }
  h3 .n { color: var(--muted); font-weight: 400; }
  ul { margin: 6px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .tag { display: inline-block; background: var(--tag); color: var(--tagfg); border-radius: 5px;
    padding: 0 6px; font-size: 11px; margin-left: 4px; }
  .who { color: var(--muted); font-size: 13px; }
  .toolbar { display: flex; gap: 10px; margin-top: 14px; }
  details { margin-top: 20px; }
  pre { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px;
    overflow-x: auto; font-size: 12px; }
  .note { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<header><h1>uwp <small>WordPress release changelog</small></h1></header>
<main>
  <form id="f">
    <label>Since<input type="date" id="since" required></label>
    <label>Until<input type="date" id="until" required></label>
    <label>Milestone<input type="text" id="milestone" placeholder="7.1" size="6"></label>
    <label>GB branch<input type="text" id="gbBranch" placeholder="wp/7.1" size="9"></label>
    <label>Core branch<input type="text" id="coreBranch" placeholder="trunk" size="8"></label>
    <div class="checks">
      <label><input type="checkbox" id="labels" checked> GB labels</label>
      <label><input type="checkbox" id="devNotes" checked> dev-notes</label>
    </div>
    <button id="go" type="submit">Generate</button>
  </form>
  <div id="status"></div>
  <div id="out"></div>
</main>
<script>
const $ = (id) => document.getElementById(id);
// default window: last 7 days
(() => {
  const d = new Date(); const iso = (x) => x.toISOString().slice(0, 10);
  $('until').value = iso(d); const s = new Date(d); s.setDate(s.getDate() - 7); $('since').value = iso(s);
})();

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const GB = 'https://github.com/WordPress/gutenberg';
const TRAC = 'https://core.trac.wordpress.org';
let lastMarkdown = '';

$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('go').disabled = true; $('out').innerHTML = ''; $('status').textContent = 'Fetching commits, labels and dev-notes…';
  const p = new URLSearchParams({
    since: $('since').value, until: $('until').value,
    milestone: $('milestone').value.trim(), gbBranch: $('gbBranch').value.trim(),
    coreBranch: $('coreBranch').value.trim(),
    labels: $('labels').checked, devNotes: $('devNotes').checked,
  });
  try {
    const r = await fetch('/api/report?' + p);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'request failed');
    lastMarkdown = data.markdown;
    render(data);
    $('status').textContent = '';
  } catch (err) {
    $('status').textContent = 'Error: ' + err.message;
  } finally {
    $('go').disabled = false;
  }
});

function render({ meta, report }) {
  const t = report.totals;
  const stat = (n, l) => \`<div class="stat"><b>\${n}</b><span>\${l}</span></div>\`;
  let h = \`<div class="cards">\${
    stat(t.gutenbergPRs, 'Gutenberg PRs') + stat(t.gutenbergCommits, 'GB commits') +
    stat(t.coreChangesets, 'Core changesets') + stat(t.coreTickets, 'Core tickets') +
    stat(t.contributors, 'Contributors')
  }</div>\`;

  // Gutenberg
  h += '<section class="group"><h2>Gutenberg <span class="who">(' + esc(meta.gbBranch) + ')</span></h2>';
  if (report.gutenberg.byCategory) {
    for (const [cat, items] of sortGroups(report.gutenberg.byCategory)) h += gbGroup(cat, items);
  } else h += '<ul>' + report.gutenberg.commits.map(gbItem).join('') + '</ul>';
  h += '</section>';

  // Core
  h += '<section class="group"><h2>Core <span class="who">(' + esc(meta.coreBranch) + ')</span></h2>';
  if (report.core.tracker) {
    h += '<p class="note">Grouped via <code>' + esc(report.core.tracker.slug) + '</code> dev-notes tracker.</p>';
    for (const [comp, items] of sortGroups(report.core.byComponent, true)) h += coreGroup(comp, items);
  } else {
    if (meta.trackerMissing) h += '<p class="note">No dev-notes tracker for this milestone — Core ungrouped.</p>';
    h += '<ul>' + report.core.commits.map(coreItem).join('') + '</ul>';
  }
  h += '</section>';

  // Contributors
  const all = [...new Set([...(report.gutenberg.contributors||[]), ...(report.core.contributors||[])])]
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  h += '<section class="group"><h2>Contributors <span class="who">(' + all.length + ')</span></h2><p>' +
    all.map((c) => esc(c)).join(', ') + '</p></section>';

  h += '<div class="toolbar"><button class="ghost" onclick="copyMd()">Copy Markdown</button>' +
    '<button class="ghost" onclick="downloadMd()">Download .md</button></div>';
  h += '<details><summary>Raw Markdown</summary><pre>' + esc(lastMarkdown) + '</pre></details>';
  $('out').innerHTML = h;
}

function sortGroups(obj, uncatLast) {
  const e = Object.entries(obj);
  return e.sort((a, b) => {
    if (uncatLast) { if (a[0] === 'Uncategorized') return 1; if (b[0] === 'Uncategorized') return -1; }
    return b[1].length - a[1].length;
  });
}
function gbGroup(cat, items) {
  return '<h3>' + esc(cat) + ' <span class="n">(' + items.length + ')</span></h3><ul>' + items.map(gbItem).join('') + '</ul>';
}
function gbItem(c) {
  const pr = c.pr ? ' <a href="' + GB + '/pull/' + c.pr + '">#' + c.pr + '</a>' : '';
  return '<li>' + esc(c.subject) + pr + ' <span class="who">' + esc(c.author) + '</span></li>';
}
function coreGroup(comp, items) {
  return '<h3>' + esc(comp) + ' <span class="n">(' + items.length + ')</span></h3><ul>' + items.map(coreItem).join('') + '</ul>';
}
function coreItem(c) {
  const ref = c.changeset ? '<a href="' + TRAC + '/changeset/' + c.changeset + '">r' + c.changeset + '</a>' : esc(c.shortSha);
  const tix = (c.tickets||[]).map((n) => '<a href="' + TRAC + '/ticket/' + n + '">#' + n + '</a>').join(' ');
  const cls = c.classification ? ' <span class="tag">' + esc(c.classification) + '</span>' : '';
  const props = c.props && c.props.length ? ' <span class="who">props ' + esc(c.props.join(', ')) + '</span>' : '';
  return '<li>' + ref + ': ' + esc(c.subject) + cls + (tix ? ' ' + tix : '') + props + '</li>';
}
function copyMd() { navigator.clipboard.writeText(lastMarkdown); }
function downloadMd() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lastMarkdown], { type: 'text/markdown' }));
  a.download = 'changelog.md'; a.click();
}
</script>
</body>
</html>`;
