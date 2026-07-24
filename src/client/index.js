import '../styles/main.scss';

var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
// Render inline code spans in changelog summaries: escape HTML first, then turn
// backtick pairs into <code>. Build the backtick char via charCode so no literal
// backtick appears in the PAGE template literal (it would close the string).
var BT = String.fromCharCode(96);
var CODE_RE = new RegExp(BT + '([^' + BT + ']+)' + BT, 'g');
var codefmt = function (s) { return esc(s).replace(CODE_RE, '<code>$1</code>'); };
var GB = 'https://github.com/WordPress/gutenberg';
var TRAC = 'https://core.trac.wordpress.org';
var CORE_GH = 'https://github.com/WordPress/wordpress-develop';
// Inline icons for the results toolbar / tabs (16px, stroke = currentColor).
function svgIc(inner) { return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
var IC = {
  post: svgIc('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>'),
  md: svgIc('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  down: svgIc('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  link: svgIc('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  list: svgIc('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  users: svgIc('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  clip: svgIc('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  table: svgIc('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  ext: svgIc('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>')
};
var lastMarkdown = '', lastPost = '', rangeSince = '', rangeUntil = '';
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(isoStr) { var p = isoStr.split('-'); return MON[(+p[1]) - 1] + ' ' + (+p[2]); }
function fmtRange(a, b) {
  var ya = a.split('-')[0], yb = b.split('-')[0];
  return ya === yb ? fmtDay(a) + ' to ' + fmtDay(b) + ', ' + ya
                   : fmtDay(a) + ', ' + ya + ' to ' + fmtDay(b) + ', ' + yb;
}

// ---- Date range picker (custom, dependency-free, works in every browser) ----
(function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var pendStart = null, hoverDay = null;
  var cal = $('cal'), grid = $('calgrid'), title = $('caltitle'), lbl = $('rangelabel'), btn = $('rangebtn');

  // default window: last 7 days
  var end0 = new Date(today), start0 = new Date(today); start0.setDate(start0.getDate() - 7);
  rangeSince = iso(start0); rangeUntil = iso(end0);
  view = new Date(end0.getFullYear(), end0.getMonth(), 1);

  function label() { lbl.textContent = (rangeSince && rangeUntil) ? fmtRange(rangeSince, rangeUntil) : 'Pick dates'; }
  function draw() {
    title.textContent = MON[view.getMonth()] + ' ' + view.getFullYear();
    $('calnext').disabled = view.getFullYear() > today.getFullYear() || (view.getFullYear() === today.getFullYear() && view.getMonth() >= today.getMonth());
    var startDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay(); // Sunday-first (US)
    var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    var s, e;
    if (pendStart) {
      if (hoverDay) { s = pendStart < hoverDay ? pendStart : hoverDay; e = pendStart < hoverDay ? hoverDay : pendStart; }
      else { s = pendStart; e = null; }
    } else { s = rangeSince; e = rangeUntil; }
    var tISO = iso(today), html = '';
    for (var i = 0; i < startDow; i++) html += '<button type="button" class="cal-cell empty" tabindex="-1"></button>';
    for (var day = 1; day <= days; day++) {
      var ds = view.getFullYear() + '-' + pad(view.getMonth() + 1) + '-' + pad(day), cls = 'cal-cell';
      if (ds > tISO) cls += ' disabled';
      if (ds === tISO) cls += ' today';
      if (s && e) { if (ds === s) cls += ' start'; if (ds === e) cls += ' end'; if (ds > s && ds < e) cls += ' inrange'; }
      else if (s && ds === s) cls += ' start end';
      html += '<button type="button" class="' + cls + '" data-d="' + ds + '">' + day + '</button>';
    }
    grid.innerHTML = html;
  }
  function open() { cal.hidden = false; btn.setAttribute('aria-expanded', 'true'); draw(); }
  function close() { cal.hidden = true; btn.setAttribute('aria-expanded', 'false'); pendStart = null; hoverDay = null; }

  btn.addEventListener('click', function (e) { e.stopPropagation(); if (cal.hidden) open(); else close(); });
  cal.addEventListener('click', function (e) { e.stopPropagation(); });
  $('calprev').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw(); });
  $('calnext').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw(); });
  grid.addEventListener('click', function (e) {
    var cell = e.target.closest ? e.target.closest('.cal-cell') : null;
    if (!cell || cell.className.indexOf('empty') !== -1 || cell.className.indexOf('disabled') !== -1) return;
    var ds = cell.getAttribute('data-d');
    if (!pendStart) { pendStart = ds; hoverDay = ds; draw(); }
    else {
      var a = pendStart, b = ds; if (b < a) { var t = a; a = b; b = t; }
      rangeSince = a; rangeUntil = b; pendStart = null; hoverDay = null; label(); close();
    }
  });
  grid.addEventListener('mouseover', function (e) {
    if (!pendStart) return;
    var cell = e.target && e.target.closest ? e.target.closest('.cal-cell') : null;
    if (!cell || cell.className.indexOf('empty') !== -1 || cell.className.indexOf('disabled') !== -1) return;
    var d = cell.getAttribute('data-d');
    if (d !== hoverDay) { hoverDay = d; draw(); }
  });
  grid.addEventListener('mouseleave', function () { if (pendStart && hoverDay !== pendStart) { hoverDay = pendStart; draw(); } });
  var presets = [['7 days', 7], ['14 days', 14], ['30 days', 30]];
  $('presets').innerHTML = presets.map(function (p) { return '<button type="button" class="preset" data-n="' + p[1] + '">' + p[0] + '</button>'; }).join('');
  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.preset') : null; if (!b) return;
    var n = +b.getAttribute('data-n'), ed = new Date(today), sd = new Date(today); sd.setDate(sd.getDate() - n);
    rangeSince = iso(sd); rangeUntil = iso(ed); pendStart = null;
    view = new Date(ed.getFullYear(), ed.getMonth(), 1); label(); close();
  });
  document.addEventListener('click', function () { if (!cal.hidden) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !cal.hidden) close(); });
  label();
})();

// ---- Setup wizard ----
function openWizard() { $('wizard').classList.add('open'); $('wizard').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function closeWizard() { $('wizard').classList.remove('open'); }
function toggleWizard() { if ($('wizard').classList.contains('open')) closeWizard(); else openWizard(); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWizard(); });

function resetFilters() {
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoD = function (x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  var d = new Date(), s = new Date(d); s.setDate(s.getDate() - 7);
  rangeSince = isoD(s); rangeUntil = isoD(d);
  $('rangelabel').textContent = fmtRange(rangeSince, rangeUntil);
  if ($('milestone').options.length) $('milestone').selectedIndex = 0;
  syncGbToMilestone(); $('coreBranch').value = 'trunk';
  $('labels').checked = true; $('devNotes').checked = true; $('devOnly').checked = false;
  $('status').textContent = ''; $('out').innerHTML = emptyState();
}
function setPill(id, set, source) {
  var el = $(id); el.className = 'pill ' + (set ? 'ok' : 'off');
  el.innerHTML = '<span class="ic"></span>' + (id === 'pillGh' ? 'GitHub' : 'Trac');
}
// First-run install wizard (blocking, stepwise). Shown until /api/installed is set.
var installerStep = 1;
function instGoto(s) {
  installerStep = s;
  $('inst1').hidden = (s !== 1);
  $('inst2').hidden = (s !== 2);
  var dots = document.querySelectorAll('.inst-dots .dot');
  for (var i = 0; i < dots.length; i++) dots[i].className = 'dot' + (i < s ? ' active' : '');
  $('instBack').hidden = (s === 1);
  $('instPrimary').textContent = (s === 1) ? 'Continue' : 'Finish setup';
  $('instEscape').hidden = true;
}
function instBack() { instGoto(1); }
function instMsg(id, t, k) { var e = $(id); e.className = 'msg' + (k ? ' ' + k : ''); e.textContent = t; }
function instPrimary() {
  if (installerStep === 1) {
    var t = $('instGh').value.trim();
    if (t) {
      instMsg('instGhMsg', 'saving…');
      fetch('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.error) { instMsg('instGhMsg', d.error, 'bad'); } else { $('instGh').value = ''; instGoto(2); } });
    } else { instGoto(2); }
  } else {
    var c = $('instCookie').value.trim();
    if (!c) { instMsg('instCookieMsg', 'Paste your cookie to finish - or continue anyway below.', 'bad'); $('instEscape').hidden = false; return; }
    instMsg('instCookieMsg', 'saving and testing…');
    fetch('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: c }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) { instMsg('instCookieMsg', x.d.error || 'could not save', 'bad'); $('instEscape').hidden = false; return; }
        return fetch('/api/cookie/test', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
          if (d.ok) { instFinishDone(); }
          else { instMsg('instCookieMsg', d.message || 'Trac could not validate the cookie.', 'bad'); $('instEscape').hidden = false; }
        });
      });
  }
}
function instContinueAnyway() { instFinishDone(); }
function instFinishDone() {
  fetch('/api/installed', { method: 'POST' }).then(function () {
    $('installer').hidden = true; document.body.classList.remove('installing'); refreshStatus();
  });
}
// Detect the browser this page is running in - the import only makes sense for
// the browser the user is actually logged into wordpress.org with.
function currentBrowser() {
  var ua = navigator.userAgent;
  if (ua.indexOf('Edg/') !== -1) return 'edge';
  if (ua.indexOf('Firefox/') !== -1) return 'firefox';
  if (ua.indexOf('Chrome/') !== -1 && ua.indexOf('OPR/') === -1) return 'chrome';
  if (ua.indexOf('Safari/') !== -1) return 'safari';
  return null;
}
// Render a single "Import from <this browser>" button into both quick-import
// slots, or hide the block when the browser isn't one we can read.
function setupQuickImport() {
  var b = currentBrowser();
  var names = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari' };
  var slots = [['instQiBtns', 'inst'], ['wizQiBtns', 'wiz']];
  slots.forEach(function (pair) {
    var box = $(pair[0]); if (!box) return;
    var block = box.closest ? box.closest('.quickimport') : null;
    if (!b) { if (block) block.style.display = 'none'; return; }
    var btn = document.createElement('button');
    btn.className = 'ghost sm'; btn.type = 'button';
    btn.textContent = 'Import from ' + names[b];
    btn.onclick = function () { importCookie(b, pair[1]); };
    box.innerHTML = ''; box.appendChild(btn);
  });
}
// One-click cookie import from a local browser store (server reads it, we never
// see the value). ctx: 'inst' (installer) or 'wiz' (setup panel).
function importCookie(browser, ctx) {
  var inst = ctx === 'inst';
  var mid = inst ? 'instCookieMsg' : 'cookieMsg';
  (inst ? instMsg : msg)(mid, 'Importing from ' + browser + '… (approve any Keychain prompt)');
  fetch('/api/cookie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browser: browser }) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (inst) {
        if (d.saved) { instFinishDone(); }
        else { instMsg(mid, d.message, 'bad'); $('instEscape').hidden = false; }
      } else {
        msg(mid, d.message, d.ok ? 'good' : 'bad'); refreshStatus();
      }
    })
    .catch(function () { (inst ? instMsg : msg)(mid, 'Import failed.', 'bad'); });
}
function refreshStatus() {
  return fetch('/api/config/status').then(function (r) { return r.json(); }).then(function (d) {
    if (!d.installed) {
      document.body.classList.add('installing');
      $('installer').hidden = false;
      if (d.github.set) {
        $('inst1Detected').hidden = false;
        $('inst1Detected').innerHTML = '<span>✓</span> GitHub ready - ' + (d.github.source === 'gh' ? 'detected from the gh CLI' : 'saved token') + ' · 5000/h';
        $('inst1Paste').hidden = true;
      } else { $('inst1Detected').hidden = true; $('inst1Paste').hidden = false; }
      instGoto(installerStep);
    } else {
      $('installer').hidden = true; document.body.classList.remove('installing');
    }
    setPill('pillGh', d.github.set, d.github.source);
    setPill('pillTrac', d.trac.set, d.trac.source);
    // GitHub step
    if (d.github.set) {
      $('stepGh').className = 'step done';
      $('ghConnected').hidden = false;
      var ghSrc = d.github.source === 'gh' ? 'GitHub CLI (gh)' : (d.github.source === 'env' ? 'GITHUB_TOKEN env' : 'saved token');
      $('ghConnected').innerHTML = '<span>✓</span> Connected · ' + ghSrc + ' · 5000/h' +
        (d.github.source === 'file' ? '<button class="disc-btn" type="button" onclick="disconnectGh()">Disconnect</button>'
          : '<span class="disc-note">' + (d.github.source === 'gh' ? 'auto-detected from the gh CLI' : 'set by env var') + '</span>');
      $('ghSetup').hidden = true;
      // A saved token beats gh (resolution order env -> file -> gh), so always
      // allow changing it - except when GITHUB_TOKEN env is set, which wins hard.
      $('ghEdit').hidden = (d.github.source === 'env');
      $('ghEdit').textContent = d.github.source === 'gh' ? 'Use your own token instead' : 'Use a different token';
    } else {
      $('stepGh').className = 'step'; $('ghConnected').hidden = true; $('ghSetup').hidden = false; $('ghEdit').hidden = true;
    }
    // Trac step
    if (d.trac.set) {
      $('stepTrac').className = 'step done';
      $('tracConnected').hidden = false;
      $('tracConnected').innerHTML = '<span>✓</span> Cookie saved · ' + d.trac.source +
        (d.trac.source === 'file' ? '<button class="disc-btn" type="button" onclick="disconnectCookie()">Disconnect</button>'
          : '<span class="disc-note">set by env var</span>');
      $('tracSetup').hidden = true; $('tracEdit').hidden = (d.trac.source !== 'file');
    } else {
      $('stepTrac').className = 'step'; $('tracConnected').hidden = true; $('tracSetup').hidden = false; $('tracEdit').hidden = true;
    }
  }).catch(function () {});
}
function editGh() { $('ghSetup').hidden = false; $('ghEdit').hidden = true; $('ghToken').focus(); }
function editTrac() { $('tracSetup').hidden = false; $('tracEdit').hidden = true; $('cookieVal').focus(); }
function disconnectGh() {
  fetch('/api/github-token', { method: 'DELETE' }).then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.error) { msg('ghMsg', d.error, 'bad'); } else { $('ghToken').value = ''; refreshStatus(); } });
}
function disconnectCookie() {
  fetch('/api/cookie', { method: 'DELETE' }).then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.error) { msg('cookieMsg', d.error, 'bad'); } else { $('cookieVal').value = ''; refreshStatus(); } });
}
function msg(id, text, kind) { var el = $(id); el.className = 'msg' + (kind ? ' ' + kind : ''); el.textContent = text; }

function saveGh() {
  var token = $('ghToken').value.trim();
  if (!token) { msg('ghMsg', 'paste the token first', 'bad'); return; }
  msg('ghMsg', 'saving…');
  fetch('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (x) { if (x.ok) { $('ghToken').value = ''; testGh(); } else msg('ghMsg', x.d.error, 'bad'); });
}
function testGh() {
  msg('ghMsg', 'testing…');
  fetch('/api/github-token/test', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
    msg('ghMsg', d.message, d.ok ? 'good' : 'bad'); refreshStatus();
  });
}

function saveCookie() {
  var cookie = $('cookieVal').value.trim();
  if (!cookie) { msg('cookieMsg', 'paste the cookie first', 'bad'); return; }
  msg('cookieMsg', 'saving…');
  fetch('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: cookie }) })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (x) { if (x.ok) { $('cookieVal').value = ''; testCookie(); } else msg('cookieMsg', x.d.error, 'bad'); });
}
function testCookie() {
  msg('cookieMsg', 'testing…');
  fetch('/api/cookie/test', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
    msg('cookieMsg', d.message, d.ok ? 'good' : 'bad'); refreshStatus();
  });
}
// auto-save+test the instant a key is pasted (one-paste flow)
$('ghToken').addEventListener('paste', function () { setTimeout(saveGh, 30); });
$('cookieVal').addEventListener('paste', function () { setTimeout(saveCookie, 30); });

// ---- Report ----
$('f').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!rangeSince || !rangeUntil) { $('status').textContent = 'Pick a date range first.'; return; }
  $('go').disabled = true; $('out').innerHTML = '';
  $('status').innerHTML = '<span class="spin"></span> Fetching commits, labels and dev-notes…';
  var p = new URLSearchParams({
    since: rangeSince, until: rangeUntil,
    milestone: $('milestone').value.trim(), gbBranch: $('gbBranch').value.trim(),
    coreBranch: $('coreBranch').value.trim(),
    labels: $('labels').checked, devNotes: $('devNotes').checked,
    devNotesOnly: $('devOnly').checked, deep: 'true',
  });
  fetch('/api/report?' + p).then(function (r) {
    return r.json().then(function (data) { if (!r.ok) throw new Error(data.error || 'request failed'); return data; });
  }).then(function (data) {
    lastMarkdown = data.markdown; lastPost = data.post; render(data); $('status').textContent = '';
  }).catch(function (err) {
    var m = err.message || 'request failed';
    if (/rate limit|\b403\b/i.test(m)) {
      $('status').innerHTML = 'GitHub rate limit reached - that is the anonymous 60 requests/hour. Add a GitHub token in Setup (any account, no scopes) for 5000/hour, then try again.';
      openWizard();
    } else if (/cookie/i.test(m)) {
      $('status').textContent = 'Error: ' + m; openWizard();
    } else {
      $('status').textContent = 'Error: ' + m;
    }
  }).finally(function () { $('go').disabled = false; });
});

function render(data) {
  var meta = data.meta, report = data.report, t = report.totals;
  var issues = (t.coreTickets || 0) + (t.gutenbergPRs || 0);
  var changes = (t.gutenbergPRs || 0) + (t.coreChangesets || 0);
  var all = uniq((report.gutenberg.contributors || []).concat(report.core.contributors || []))
    .sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  window._data = data;
  window._props = all;
  window._propsLine = all.join(', ');

  var dn = !!meta.devNotesOnly;
  var h = '<div class="rhead"><div class="lead-metric"><b class="tnum">' + issues +
    '</b><span>' + (dn ? 'dev notes / field guide tickets, ' : 'issues addressed, ') + esc(fmtRange(rangeSince, rangeUntil)) + '</span></div>';
  var stat = function (n, l) { return '<div class="stat"><b class="tnum">' + n + '</b><span>' + l + '</span></div>'; };
  h += '<div class="stats">' + (dn ? '' : stat(t.gutenbergPRs, 'Gutenberg PRs') + stat(t.gutenbergCommits, 'GB commits')) +
    stat(t.coreChangesets, dn ? 'Dev-note changesets' : 'Core changesets') + stat(t.coreTickets, dn ? 'Dev-note tickets' : 'Core tickets') +
    stat(t.contributors, 'Contributors') + '</div></div>';

  if (meta.deepError) h += '<div class="warn">Deep descriptions skipped (' + esc(meta.deepError) +
    '). Showing the cookie-free changelog. Save a fresh wordpress.org cookie in Setup for full descriptions.</div>';

  h += '<div class="tabs" role="tablist">' +
    '<button class="tab active" data-tab="changelog">' + IC.list + 'Changelog<span class="cbadge">' + changes + '</span></button>' +
    '<button class="tab" data-tab="props">' + IC.users + 'Props<span class="cbadge">' + all.length + '</span></button>' +
    '<div class="tabtools">' +
      '<button class="ghost sm" onclick="copyPost()">' + IC.post + 'Copy post</button>' +
      '<button class="ghost sm" onclick="copyMd()">' + IC.md + 'Copy Markdown</button>' +
      '<button class="ghost sm" onclick="downloadMd()">' + IC.down + 'Download</button>' +
    '</div></div>';

  var cl = '';
  var s = data.sources || {};
  if (data.sources) {
    var mile = s.milestone ? ' (milestone ' + esc(s.milestone) + ')' : '';
    cl += '<section class="card sources"><h2>Sources <em>link these in the post so anyone can verify</em></h2>' +
      srcRow(s.trac, 'Closed Core Trac tickets' + mile + ', ' + esc(s.since) + ' to ' + esc(s.until)) +
      srcRow(s.gutenberg, 'Gutenberg commits on ' + esc(s.gbBranch) + ', ' + esc(s.since) + ' to ' + esc(s.until)) +
      '</section>';
  }
  if (report.gutenberg.byCategory || report.gutenberg.commits.length) {
    cl += '<section class="group">' + groupHead('Gutenberg', s.gutenberg, meta.gbBranch);
    if (report.gutenberg.byCategory) sortGroups(report.gutenberg.byCategory).forEach(function (g) { cl += gbGroup(g[0], g[1]); });
    else cl += '<ul class="list">' + report.gutenberg.commits.map(gbItem).join('') + '</ul>';
    cl += '</section>';
  }
  cl += '<section class="group">' + groupHead('Core', s.trac, meta.coreBranch);
  if (report.core.tracker) {
    cl += '<p class="note">Grouped via <code>' + esc(report.core.tracker.slug) + '</code> dev-notes tracker.</p>';
    sortGroups(report.core.byComponent, true).forEach(function (g) { cl += coreGroup(g[0], g[1]); });
  } else {
    if (meta.trackerMissing) cl += '<p class="note">No dev-notes tracker for this milestone. Core stays ungrouped.</p>';
    cl += '<ul class="list">' + report.core.commits.map(coreItem).join('') + '</ul>';
  }
  cl += '</section>';
  cl += '<details><summary>Post template</summary><pre>' + esc(lastPost) + '</pre></details>';
  cl += '<details><summary>Raw Markdown</summary><pre>' + esc(lastMarkdown) + '</pre></details>';
  h += '<div class="panel" id="p-changelog">' + cl + '</div>';

  var pv = '<div class="propshead">' +
    '<div class="props-metric"><b class="tnum">' + all.length + '</b><span>contributors with props this window</span></div>' +
    '<div class="props-actions">' +
      '<label class="atbox"><input type="checkbox" id="propsAt" onchange="applyPropsFormat()"> Add @ before names</label>' +
      '<button class="ghost sm" onclick="copyProps()">' + IC.clip + 'Copy props line</button>' +
      '<button class="ghost sm" onclick="copyCsv()">' + IC.table + 'CSV</button>' +
      '<button class="ghost sm" onclick="copyPhp()">' + IC.md + 'PHP array</button>' +
    '</div></div>';
  pv += '<p class="propslist" id="propsList">' + all.map(esc).join(', ') + '</p>';
  pv += '<p class="note props-hint" id="propsHint" hidden>Slack handles usually match the wp.org username, but not always. Double-check before pinging.</p>';
  h += '<div class="panel hidden" id="p-props">' + pv + '</div>';

  $('out').innerHTML = h;
}

// Section heading that links to the same source URL as the Sources block, so the
// list visibly points back at the real GitHub / Trac query it was built from.
function groupHead(label, url, who) {
  var inner = url ? '<a class="grouplink" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + IC.ext + '</a>' : label;
  return '<h2>' + inner + ' <span class="who">(' + esc(who) + ')</span></h2>';
}
function srcRow(url, text) {
  return '<div class="srcrow"><a href="' + esc(url) + '" target="_blank" rel="noopener">' + text + '</a>' +
    '<button class="ghost sm" onclick="copyText(this.dataset.u)" data-u="' + esc(url) + '">' + IC.link + 'Copy link</button></div>';
}
function uniq(arr) { var seen = {}, out = []; arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
function sortGroups(obj, uncatLast) {
  return Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) {
    if (uncatLast) { if (a[0] === 'Uncategorized') return 1; if (b[0] === 'Uncategorized') return -1; }
    return b[1].length - a[1].length;
  });
}
function gbGroup(cat, items) { return '<h3 class="grp">' + esc(cat) + ' <span class="n">(' + items.length + ')</span></h3><ul class="list">' + items.map(gbItem).join('') + '</ul>'; }
function gbItem(c) {
  var ref = c.pr
    ? '<a class="ref" href="' + GB + '/pull/' + c.pr + '" target="_blank" rel="noopener">#' + c.pr + '</a>'
    : (c.sha ? '<a class="ref" href="' + GB + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : '');
  return '<li>' + codefmt(c.subject) + (ref ? ' ' + ref : '') + ' <span class="who">' + esc(c.author) + '</span></li>';
}
function coreGroup(comp, items) { return '<h3 class="grp">' + esc(comp) + ' <span class="n">(' + items.length + ')</span></h3><ul class="list">' + items.map(coreItem).join('') + '</ul>'; }
function coreItem(c) {
  var ref = c.changeset
    ? '<a class="ref" href="' + TRAC + '/changeset/' + c.changeset + '" target="_blank" rel="noopener">r' + c.changeset + '</a>'
    : (c.sha ? '<a class="ref" href="' + CORE_GH + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : esc(c.shortSha));
  var tix = (c.tickets || []).map(function (n) { return '<a class="ref" href="' + TRAC + '/ticket/' + n + '" target="_blank" rel="noopener">#' + n + '</a>'; }).join(' ');
  var cls = c.classification ? ' <span class="tag">' + esc(c.classification) + '</span>' : '';
  var props = c.props && c.props.length ? ' <span class="who">props ' + esc(c.props.join(', ')) + '</span>' : '';
  return '<li>' + ref + ': ' + codefmt(c.subject) + cls + (tix ? ' ' + tix : '') + props + '</li>';
}
// Small confirmation toast, shown after any copy / download.
function toast(msg) {
  var t = $('toast'); if (!t) return;
  t.textContent = '✓ ' + msg; t.className = 'toast show';
  clearTimeout(window._toastT);
  window._toastT = setTimeout(function () { t.className = 'toast'; }, 1800);
}
function copyText(s) { navigator.clipboard.writeText(s); toast('Link copied'); }
function copyPost() { navigator.clipboard.writeText(lastPost); toast('Post copied'); }
function copyMd() { navigator.clipboard.writeText(lastMarkdown); toast('Markdown copied'); }
// Rewrite the props list + copy line when the "@ before names" toggle changes.
// Usernames are wp.org handles (alnum / _ / -), so textContent is safe and enough.
function applyPropsFormat() {
  var at = $('propsAt') && $('propsAt').checked;
  var list = (window._props || []).map(function (n) { return (at ? '@' : '') + n; });
  window._propsLine = list.join(', ');
  var el = $('propsList'); if (el) el.textContent = window._propsLine;
  var hint = $('propsHint'); if (hint) hint.hidden = !at;
}
function copyProps() { navigator.clipboard.writeText(window._propsLine || ''); toast('Props copied'); }
// CSV + PHP array use the raw usernames (the @ toggle is only for the props line).
// Build newline/tab via charCode: escape sequences in this inlined script get
// interpreted by the outer PAGE template literal, which would break the strings.
var NL = String.fromCharCode(10), TAB = String.fromCharCode(9);
function copyCsv() { navigator.clipboard.writeText((window._props || []).join(NL)); toast('CSV copied'); }
function copyPhp() {
  var arr = (window._props || []).map(function (n) { return TAB + "'" + String(n).replace(/'/g, "\\'") + "',"; });
  navigator.clipboard.writeText('array(' + NL + arr.join(NL) + NL + ')');
  toast('PHP array copied');
}
function downloadMd() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lastMarkdown], { type: 'text/markdown' }));
  a.download = 'changelog.md'; a.click();
  toast('Downloaded changelog.md');
}

// Tab switching (delegated, survives re-render)
document.addEventListener('click', function (e) {
  var tab = e.target && e.target.closest ? e.target.closest('.tab') : null;
  if (!tab) return;
  var name = tab.getAttribute('data-tab');
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i] === tab);
  var panels = document.querySelectorAll('.panel');
  for (var j = 0; j < panels.length; j++) panels[j].classList.toggle('hidden', panels[j].id !== 'p-' + name);
});

function emptyState() {
  return '<div class="empty"><img src="/brand/bulb.svg" alt=""><h3>No changelog yet</h3>' +
    '<p>Pick a date range and a milestone, then Generate. You get the counts, the source links, ' +
    'the grouped changelog, and the props.</p></div>';
}

// Searchable branch pickers (branches fetched live from GitHub)
// Populate the milestone + branch <select>s from GitHub (branches drive both).
function fillSelect(sel, list, preferred) {
  sel.innerHTML = list.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
  if (preferred && list.indexOf(preferred) !== -1) sel.value = preferred;
}
function syncGbToMilestone() {
  var want = 'wp/' + $('milestone').value, sel = $('gbBranch');
  for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === want) { sel.value = want; return; } }
}
(function loadBranches() {
  var gb = fetch('/api/branches?repo=gutenberg').then(function (r) { return r.json(); }).then(function (d) {
    var list = d.branches || [], versions = [];
    list.forEach(function (b) { if (b.indexOf('wp/') === 0) { var v = b.slice(3); if (/^[0-9]+[.][0-9]+$/.test(v) && versions.indexOf(v) === -1) versions.push(v); } });
    fillSelect($('gbBranch'), list.slice(0, 80), null);
    fillSelect($('milestone'), versions, null);
    if (versions.length) $('milestone').value = versions[0];
    syncGbToMilestone();
  }).catch(function () {});
  var core = fetch('/api/branches?repo=core').then(function (r) { return r.json(); }).then(function (d) {
    fillSelect($('coreBranch'), (d.branches || []).slice(0, 80), 'trunk');
  }).catch(function () {});
  // Reveal the search form only once both pickers are populated (spinner until then).
  Promise.all([gb, core]).then(function () { $('filters').classList.remove('loading'); });
})();
$('milestone').addEventListener('change', syncGbToMilestone);

(function () { var y = $('year'); if (y) y.textContent = new Date().getFullYear(); })();
(function () { // pin the tool rail just under the sticky header; shadow the header on scroll
  var header = document.querySelector('header'), rail = document.querySelector('.rail');
  function place() { if (rail) rail.style.top = (header.offsetHeight + 12) + 'px'; }
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 4); }
  window.addEventListener('resize', place);
  window.addEventListener('scroll', onScroll, { passive: true });
  place(); onScroll();
})();

$('out').innerHTML = emptyState();

setupQuickImport();
refreshStatus();
