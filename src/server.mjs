import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { authenticated, tokenStatus, saveToken, deleteToken, checkToken } from './github.mjs';
import { resolveCookie, saveCookie, deleteCookie, cookiePath, validateCookie } from './trac.mjs';
import { importWporgCookie } from './cookie-import.mjs';
import { loadPlugins } from './plugins.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
// UnleashWP full-color wordmark for the white header bar (inverted to white in dark mode).
const stripXml = (s) => s.replace(/<\?xml[^?]*\?>/, '').trim();
const LOGO = stripXml(readFileSync(join(DIR, 'brand/unleashwp-logo-full.svg'), 'utf8'));
const BULB_FILE = readFileSync(join(DIR, 'brand/bulb-full.svg'), 'utf8');

export function startServer({ port = 4321 } = {}) {
  // Load tool plugins once; every request awaits the same promise.
  const pluginsReady = loadPlugins();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    // Webpack bundles (SCSS -> main.css, client JS -> main.js), served from dist/.
    if (url.pathname === '/assets/main.css' || url.pathname === '/assets/main.js') {
      const isCss = url.pathname.endsWith('.css');
      try {
        const body = readFileSync(join(DIR, '..', 'dist', isCss ? 'main.css' : 'main.js'), 'utf8');
        res.writeHead(200, { 'Content-Type': (isCss ? 'text/css' : 'application/javascript') + '; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(body);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Bundle missing - run `npm run build`.');
      }
      return;
    }
    // Tool registry: the rail + tool head render from these manifests.
    if (url.pathname === '/api/plugins') {
      json(res, 200, { plugins: (await pluginsReady).map((p) => p.manifest) });
      return;
    }
    if (url.pathname === '/brand/bulb.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'max-age=86400' });
      res.end(BULB_FILE);
      return;
    }

    // Combined credential status for the setup wizard (never returns the values).
    if (url.pathname === '/api/config/status') {
      const c = resolveCookie();
      json(res, 200, {
        installed: isInstalled(),
        github: tokenStatus(),
        trac: {
          set: !!c,
          source: process.env.WPORG_TRAC_COOKIE ? 'env' : 'file',
          path: cookiePath(),
          envLocked: !!process.env.WPORG_TRAC_COOKIE,
        },
      });
      return;
    }

    if (url.pathname === '/api/installed' && req.method === 'POST') {
      markInstalled();
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/github-token' && req.method === 'POST') {
      if (process.env.GITHUB_TOKEN) { json(res, 400, { error: 'GITHUB_TOKEN env is set and overrides the file. Unset it to save one here.' }); return; }
      const value = (JSON.parse(await readBody(req) || '{}').token || '').trim();
      if (!value) { json(res, 400, { error: 'empty token' }); return; }
      json(res, 200, { ok: true, path: saveToken(value) });
      return;
    }

    if (url.pathname === '/api/github-token' && req.method === 'DELETE') {
      if (process.env.GITHUB_TOKEN) { json(res, 400, { error: 'GITHUB_TOKEN env is set; unset it in your shell to disconnect.' }); return; }
      deleteToken();
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/github-token/test' && req.method === 'POST') {
      try {
        json(res, 200, await checkToken());
      } catch (err) {
        json(res, 200, { ok: false, message: err.message });
      }
      return;
    }

    if (url.pathname === '/api/cookie' && req.method === 'POST') {
      if (process.env.WPORG_TRAC_COOKIE) return json(res, 400, { error: 'WPORG_TRAC_COOKIE env is set and overrides the file. Unset it to save one here.' });
      const value = (JSON.parse(await readBody(req) || '{}').cookie || '').trim();
      if (!value) return json(res, 400, { error: 'empty cookie' });
      json(res, 200, { ok: true, path: saveCookie(value) });
      return;
    }

    if (url.pathname === '/api/cookie' && req.method === 'DELETE') {
      if (process.env.WPORG_TRAC_COOKIE) { json(res, 400, { error: 'WPORG_TRAC_COOKIE env is set; unset it in your shell to disconnect.' }); return; }
      deleteCookie();
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/cookie/import' && req.method === 'POST') {
      if (process.env.WPORG_TRAC_COOKIE) { json(res, 200, { ok: false, message: 'WPORG_TRAC_COOKIE env is set and overrides the file. Unset it to import.' }); return; }
      const browser = (JSON.parse(await readBody(req) || '{}').browser || '').trim();
      try {
        const cookie = importWporgCookie(browser); // read from the local browser store
        saveCookie(cookie);                          // persist (owner-only); value never returned
        const ok = await validateCookie(cookie);
        json(res, 200, { ok, saved: true, message: ok
          ? `Imported from ${browser} and verified - Trac reachable.`
          : `Imported from ${browser}, but Trac rejected it (expired session or bot wall). Saved anyway; the tool runs cookie-free.` });
      } catch (err) {
        json(res, 200, { ok: false, message: err.message });
      }
      return;
    }

    if (url.pathname === '/api/cookie/test' && req.method === 'POST') {
      const c = resolveCookie();
      if (!c) return json(res, 200, { ok: false, message: 'No cookie set yet.' });
      try {
        const ok = await validateCookie(c);
        json(res, 200, { ok, message: ok ? 'Cookie works. Trac reachable.' : 'Trac rejected it (expired or wrong cookie).' });
      } catch (err) {
        json(res, 200, { ok: false, message: err.message });
      }
      return;
    }

    // Tool plugin routes (e.g. the Changelog Generator's /api/report + /api/branches).
    const plugins = await pluginsReady;
    for (const p of plugins) {
      for (const r of p.routes) {
        if (req.method === r.method && url.pathname === r.path) {
          await r.handler(req, res, url, { json });
          return;
        }
      }
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`uwp: port ${port} is already in use. Try \`uwp serve --port ${port + 1}\`.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`uwp browser UI  ->  http://localhost:${port}`);
    if (!authenticated()) console.log('uwp: no gh token. GitHub API limited to 60 req/h (add one in Setup).');
    console.log('Press Ctrl+C to stop.');
  });
  return server;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// First-run marker: the install wizard writes this once it's finished, so it
// only blocks the very first launch. Lives beside the cookie/token files.
function installedPath() { return join(dirname(cookiePath()), 'installed'); }
function isInstalled() { return existsSync(installedPath()); }
function markInstalled() {
  const p = installedPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, '1\n', { mode: 0o600 });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
  });
}

// UnleashWP light-bulb mark (design system assets/brand/bulb-full.svg).
const BULB = `<svg class="bulb" viewBox="0 0 500 500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="#203058" d="M360.46,93.68c3.61-.11,7.79,3.21,7.49,7.01-.22,2.84-14.57,19.75-17.42,20.26-5.68,1.02-9.36-4.27-7.59-9.35.8-2.28,14.92-17.84,17.51-17.92Z"/><path fill="#203058" d="M402.2,150.11c5.6-.12,9.52,5.63,6.46,10.57-.73,1.17-19.82,9.79-21.34,9.86-6.03.29-10.22-6.21-6.39-11.02.72-.91,20.11-9.39,21.27-9.41Z"/><path fill="#203058" d="M403.66,225.72c3.86.6,10.59.72,12.54,4.55,1.91,3.76-.85,9.42-5.03,9.67-1.57.09-20.35-2.04-21.47-2.49-4.69-1.86-5.09-9.76-.39-12.16,2.42-1.24,11.27-.05,14.36.42Z"/><path fill="#203058" d="M273.38,56.09c3.5.02,6.99,2.86,7.11,6.48.09,2.83-2.96,19.81-4.37,21.64-3.52,4.56-11.68,1.42-11.89-4.22-.07-1.89,2.45-17.74,3.11-19.51.71-1.9,3.98-4.4,6.05-4.39Z"/><path fill="#203058" d="M91.9,176.1c1.77.03,18.92,3.47,20.28,4.16,5.92,2.97,3.42,12.24-2.02,12.71-1.52.13-20.27-3.67-21.64-4.37-5.84-3.02-3.11-12.6,3.38-12.49Z"/><path fill="#203058" d="M178.89,68.04c1.63-.14,4.43.77,5.75,1.85.79.65,8.68,17.17,8.94,18.41,1.48,7.02-5.75,11.1-11.09,6.84-2.03-1.62-9.64-20.2-8.67-23.02.38-1.11,3.86-3.97,5.07-4.08Z"/><path fill="#203058" d="M118.55,122.65c.91.08,14.33,8.46,15.25,9.41,4.77,4.89.86,10.68-5.15,8.95-1.8-.52-15.33-10.42-15.54-12.01-.38-2.98,2.22-6.64,5.43-6.35Z"/><path fill="#5d687f" d="M263.12,417.38c-5.15,5.34-10.3,4.62-14.68,7.44l-61.72-9.82c-3.4-4.01-8.48-4.88-11.64-11.62-.64-1.36-3.06-8.09-1.2-8.57l93.48,14.88c.93.81-3.44,6.86-4.25,7.7Z"/><path fill="#373a50" d="M248.44,424.82c-1.61,1.03-4.61,5.45-6.71,7.07-17.36,13.42-38.02,10.8-50.44-7.56-1.52-2.25-3.43-8-4.56-9.33l61.72,9.82Z"/><path fill="#363950" d="M263.12,417.38c.81-.84,5.18-6.89,4.25-7.7l-93.48-14.88c-1.86.47.56,7.21,1.2,8.57-7.3-1.55-17.01-7.56-12.32-16.15.55-1.01,3.18-2.54,3.23-2.74.15-.62-3.33-6.4-1.3-12.3,1-2.9,6.08-6.02,6.15-6.47.09-.56-4.15-6.2-3.93-10.4.27-5.21,5.58-11.02,5.58-11.67,0-.28-2.63-3.52-2.98-4.66-3.51-11.38,2.83-21.63.14-33.01-1.88-7.96-20.54-27.57-26.11-37.66-46.73-84.68,23.58-180.87,116.86-171.48,110.18,11.1,153.1,146.01,61.09,212.59-6.33,4.58-18.73,9.91-22.81,16.15-6.57,10.04-3.11,21.93-10.79,32.71-.45.63-3.69,2.89-3.75,3.12-.11.4,2.5,5.69,2.47,7.84-.09,8.16-6.52,11.84-6.78,13.35-.08.47,3.3,6.1,3.24,8.89-.12,5.8-4.93,10.23-4.98,10.84-.02.23,1.95,2.69,2.15,4.06,1.31,9.41-9.9,11.68-17.11,11Z"/><path fill="#ffb33d" d="M249.63,350.1c-.03-1.44-.55-1.18.97-1.71,3.08-1.08,6.09-.57,9.73-2.64,10.18-5.8,9.74-17.78,13.43-27.41,5.85-15.25,19.95-20.21,30.97-30.9,59.22-57.43,37.53-151.34-41.67-175.3-6.05-1.83-13.74-2.06-18.93-5.34,100.28-3.24,158.9,113.74,83.21,184.7-12.46,11.68-34.59,19.27-40.46,34.97-2.48,6.63-2.83,27.27-11.17,27.77-1.68.1-24.93-3.52-26.09-4.15Z"/><path fill="#ffbe3d" d="M209.53,341.85c-.2.55.02,1.39-.52,1.78-1.28.51-25.98-3.74-27.23-4.33-6.52-3.08-1.87-18.56-1.57-23.75,1.07-18.7-7.42-23.33-17-36.44,3.46.46,8.69,3.62,11.9,5.62,20.73,12.88,16.34,18.54,15.81,39.51-.29,11.36,8.97,15.42,18.6,17.62Z"/><path fill="#ffd952" d="M244.14,106.81c5.19,3.28,12.88,3.51,18.93,5.34,79.19,23.95,100.89,117.87,41.67,175.3-11.02,10.69-25.13,15.65-30.97,30.9-3.69,9.63-3.26,21.61-13.43,27.41-3.64,2.07-6.64,1.56-9.73,2.64-1.52.53-1,.27-.97,1.71l-.87-.37c3.86-15.72,3.76-35.07,8.02-50.37,7.05-25.35,30.69-56.73,39.66-82.56,1.93-18.55-14.97-3.1-17.36-3.46-1.98-.3-2.89-7.86-6.94-9.01-6.18-1.76-10.13,6.84-12.26,6.89-3.3.08-3.57-13.42-12.84-9.95-1.63.61-5.64,5.99-6.53,5.94-8.61-18.52-13.86-2.9-17.24-2.74s-7.64-11.82-14.87-8.88c-3.41,1.38-3.51,5.45-3.45,8.52.48,26.61,13.51,63.58,12.29,89.43-.37,7.8-5.34,41.74-7.69,48.33-9.63-2.19-18.89-6.26-18.6-17.62.53-20.97,4.91-26.62-15.81-39.51-3.21-2-8.44-5.15-11.9-5.62-53.82-73.6-9.41-169.38,80.93-172.31Z"/><path fill="#ffffff" d="M219.07,128.41c7.33,0,12.24,6.37,8.82,13.27-1.83,3.7-15.51,8.14-20.13,10.99-15.64,9.65-26.8,25.78-32.66,42.96-1.99,5.84-1.58,18.66-10.63,18.55-19.51-.24-.6-39.62,4.6-47.89,7.68-12.24,35.11-37.89,50-37.87Z"/><path fill="#ffd951" d="M248.76,210.84c5.23,10.87,12.53,12.72,20.87,3.32,2.94,7.13,7.6,10.37,14.66,5.82l-33.67,69.79c-5.21-8.15-17.05-9.98-24.51-3.9-3.74-25.02-7.76-50.94-10.23-76.07,5.31,6.61,10.54,3.6,15.55-1.25,4.27,10.49,10.21,10.36,17.32,2.29Z"/><path fill="#ffc33e" d="M243.08,291.82l1.46,8.37-8.07,47.8c-5.98-.33-12.19-2.21-18.12-3.12l7.8-49.01c3.65-6.49,10.64-8.52,16.93-4.05Z"/><path fill="#768299" d="M177.57,371.66l93.48,14.88c5.84,4.36,3.41,12.53-3.22,14.38l-91.67-14.59c-5.86-3.73-5.6-12.46,1.4-14.67Z"/><path fill="#7c889f" d="M181.25,348.52l93.03,14.8c6.11,3.84,3.69,13.58-3.22,14.38l-91.21-14.52c-6.2-3.42-5.51-12.29,1.4-14.67Z"/></svg>`;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Release Helper · UnleashWP</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(BULB)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/main.css">
</head>
<body>
<div class="installer" id="installer" hidden>
  <div class="inst-card">
    <div class="inst-head">
      <span class="logo" aria-label="UnleashWP">${LOGO}</span>
      <div class="inst-dots"><span class="dot" data-s="1"></span><span class="dot" data-s="2"></span></div>
    </div>
    <div class="inst-body">
      <div class="inst-step" id="inst1">
        <span class="inst-kicker">Step 1 of 2</span>
        <h2>Connect GitHub</h2>
        <p>Raises your API limit from 60 to 5000 requests an hour. Works with <b>any</b> GitHub account - no access to the WordPress org, no token scopes. It only reads public repos.</p>
        <div class="inst-ok" id="inst1Detected" hidden></div>
        <div id="inst1Paste">
          <ol><li>Detected automatically if the <code>gh</code> CLI is logged in, or <a href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener">create a token</a> (leave every scope unchecked) and paste it:</li></ol>
          <form onsubmit="return false" autocomplete="off" style="margin:0"><input type="password" id="instGh" placeholder="ghp_… or github_pat_…  (optional - skip for 60/h)" autocomplete="off" spellcheck="false"></form>
          <span class="msg" id="instGhMsg"></span>
        </div>
      </div>
      <div class="inst-step" id="inst2" hidden>
        <span class="inst-kicker">Step 2 of 2</span>
        <h2>Connect WordPress.org</h2>
        <p>Needed for <b>deep</b> - full Trac ticket descriptions. Paste your session cookie once; it is stored locally (owner-only) and sent only to WordPress.org.</p>
        <div class="quickimport">
          <span class="qi-label">Quick import from your browser <span class="qi-note">(you must be logged in there)</span></span>
          <div class="qi-btns" id="instQiBtns"></div>
        </div>
        <details class="qi-manual"><summary>Or paste it manually</summary>
          <ol>
            <li><a href="https://wordpress.org/" target="_blank" rel="noopener">Log in to wordpress.org</a>.</li>
            <li>DevTools → Application → Cookies → <code>wordpress.org</code> → copy <code>wporg_logged_in</code> + <code>wporg_sec</code> as <code>name=value; name=value</code>.</li>
          </ol>
          <textarea id="instCookie" rows="3" placeholder="wporg_logged_in=…; wporg_sec=…"></textarea>
        </details>
        <span class="msg" id="instCookieMsg"></span>
        <div class="inst-escape" id="instEscape" hidden>Trac isn't reachable right now (bot wall or expired cookie). You can <button class="back" type="button" onclick="instContinueAnyway()">continue anyway</button> - the tool runs cookie-free and you can add the cookie later in Setup.</div>
      </div>
    </div>
    <div class="inst-foot">
      <button class="back" type="button" id="instBack" hidden onclick="instBack()">Back</button>
      <button class="primary" type="button" id="instPrimary" onclick="instPrimary()">Continue</button>
    </div>
  </div>
</div>
<header>
  <div class="bar">
    <a class="logo" href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP">${LOGO}</a>
    <span class="divider"></span>
    <a href="#" class="product" onclick="window.scrollTo({ top: 0, behavior: 'smooth' }); return false;">Release Helper</a>
    <div class="pills">
      <button class="pill" id="pillGh" onclick="toggleWizard()"><span class="ic"></span>GitHub</button>
      <button class="pill" id="pillTrac" onclick="toggleWizard()"><span class="ic"></span>Trac</button>
    </div>
  </div>
</header>
<div class="shell">
  <aside class="rail">
    <span class="rail-cap">Tools</span>
    <div id="railTools">
      <button type="button" class="tool active" aria-current="true">
        <span class="tool-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></span>
        <span class="tool-name">Changelog Generator</span>
      </button>
      <button type="button" class="tool is-more" disabled>
        <span class="tool-ic">+</span>
        <span class="tool-name">More soon</span>
      </button>
    </div>
  </aside>
  <main>
    <div class="tool-head">
      <h1 id="toolTitle">Changelog Generator</h1>
      <p id="toolDesc">Turn a date window into a ready release-post changelog for Core and Gutenberg.</p>
    </div>
    <section class="filters loading" id="filters">
    <div class="filters-loading"><span class="spin"></span> Loading milestones and branches…</div>
    <form class="query" id="f">
      <div class="qfields">
        <div class="rangewrap">
          <span class="flabel">Date range</span>
          <button type="button" class="rangebtn" id="rangebtn" aria-haspopup="true" aria-expanded="false"><span id="rangelabel">Pick dates</span></button>
          <div class="cal" id="cal" hidden>
            <div class="cal-presets" id="presets"></div>
            <div class="cal-head">
              <button type="button" class="cal-nav" id="calprev" aria-label="Previous month"></button>
              <div class="cal-title" id="caltitle"></div>
              <button type="button" class="cal-nav" id="calnext" aria-label="Next month"></button>
            </div>
            <div class="cal-dow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
            <div class="cal-grid" id="calgrid"></div>
          </div>
        </div>
        <label>Milestone<select id="milestone" class="branch-select mile-select"></select></label>
        <label>Gutenberg branch<select id="gbBranch" class="branch-select"></select></label>
        <label>Core branch<select id="coreBranch" class="branch-select"></select></label>
      </div>
      <div class="qactions">
        <div class="checks">
          <label><input type="checkbox" id="labels" checked> Group Gutenberg <span class="info" data-tip="Group Gutenberg changes by label (Bug, Feature). Off shows one flat list." onclick="event.preventDefault()">i</span></label>
          <label><input type="checkbox" id="devNotes" checked> Group Core <span class="info" data-tip="Group Core changes by component (Editor, REST API). Off shows one flat list." onclick="event.preventDefault()">i</span></label>
          <label><input type="checkbox" id="devOnly"> Dev notes only <span class="info" data-tip="Keep only Core tickets flagged dev-note / misc-dev-note / field-guide in the docs tracker. Perfect for Field Guide prep." onclick="event.preventDefault()">i</span></label>
        </div>
        <div class="go"><button type="button" class="reset-link" onclick="resetFilters()">Reset</button><button class="primary" id="go" type="submit">Generate</button></div>
      </div>
    </form>
    </section>
  <section class="card wizard" id="wizard">
    <button class="wiz-close" type="button" onclick="closeWizard()" aria-label="Close setup">&times;</button>
    <h2>Setup</h2>
    <p class="lead">Two keys, both stored locally (owner-only file) and sent only to GitHub / WordPress.org. Each is your own - nothing is shared. The same keys power <code>uwp --deep</code> on the CLI.</p>
    <div class="steps">
      <div class="step" id="stepGh">
        <div class="num"><span class="d">1</span></div>
        <div>
          <h3>GitHub <em>lifts the API limit from 60 to 5000 requests an hour</em></h3>
          <div id="ghConnected" class="connected" hidden></div>
          <div id="ghSetup">
            <p>Works with <b>any</b> GitHub account. You do <b>not</b> need access to the WordPress org, and the token needs <b>no scopes</b> - it only reads public repos and raises your rate limit. Skip it and the tool still runs at 60 requests an hour.</p>
            <ol><li>One click if the <code>gh</code> CLI is logged in (detected automatically), or <a href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener">create a token</a> (leave every scope unchecked) and paste it below.</li></ol>
            <form onsubmit="return false" autocomplete="off" style="margin:0"><input type="password" id="ghToken" placeholder="ghp_… or github_pat_…" autocomplete="off" spellcheck="false"></form>
            <div class="rowbtns">
              <button class="primary sm" type="button" onclick="saveGh()">Save &amp; connect</button>
              <button class="ghost sm" type="button" onclick="testGh()">Test</button>
              <span class="msg" id="ghMsg"></span>
            </div>
          </div>
          <button class="expander" id="ghEdit" hidden onclick="editGh()">Use a different token</button>
        </div>
      </div>
      <div class="step" id="stepTrac">
        <div class="num"><span class="d">2</span></div>
        <div>
          <h3>WordPress.org <em>only needed for “deep” (full ticket descriptions)</em></h3>
          <div id="tracConnected" class="connected" hidden></div>
          <div id="tracSetup">
            <p>A web page can't read this cookie for you (it's HttpOnly). Quickest is to import it straight from the browser you're logged into:</p>
            <div class="quickimport">
              <span class="qi-label">Quick import <span class="qi-note">(macOS)</span></span>
              <div class="qi-btns" id="wizQiBtns"></div>
            </div>
            <details class="qi-manual"><summary>Or paste it manually</summary>
              <ol>
                <li><a href="https://wordpress.org/" target="_blank" rel="noopener">Log in to wordpress.org</a>.</li>
                <li>DevTools → Application → Cookies → <code>wordpress.org</code> → copy <code>wporg_logged_in</code> + <code>wporg_sec</code> as <code>name=value; name=value</code>.</li>
              </ol>
              <textarea id="cookieVal" rows="3" placeholder="wporg_logged_in=…; wporg_sec=…"></textarea>
            </details>
            <div class="rowbtns">
              <button class="primary sm" type="button" onclick="saveCookie()">Save &amp; connect</button>
              <button class="ghost sm" type="button" onclick="testCookie()">Test</button>
              <span class="msg" id="cookieMsg"></span>
            </div>
          </div>
          <button class="expander" id="tracEdit" hidden onclick="editTrac()">Replace the cookie</button>
        </div>
      </div>
    </div>
  </section>

  <div id="status"></div>
  <div id="out" class="results"></div>
  </main>
</div>
<footer class="site-footer">
  <div class="finner">
    <div class="fleft">
      <span>&copy; <span id="year">2026</span> <a href="https://unleash-wp.com" target="_blank" rel="noopener">UnleashWP</a> · Benjamin Zekavica · data via <a href="https://github.com/Automattic/mcp-context-wporg" target="_blank" rel="noopener">Automattic mcp-context-wporg</a></span>
      <span class="fnote">Independent project, not affiliated with Automattic or the WordPress project.</span>
    </div>
    <a class="ficon" href="https://github.com/unleash-wp/wp-release-helper" target="_blank" rel="noopener" aria-label="Contribute on GitHub" title="Contribute on GitHub"><svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>
  </div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/assets/main.js" defer></script>
</body>
</html>`;
