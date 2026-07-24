import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { authenticated, tokenStatus, saveToken, deleteToken, checkToken } from './github.mjs';
import { resolveCookie, saveCookie, deleteCookie, cookiePath, validateCookie } from './trac.mjs';
import { importWporgCookie } from './cookie-import.mjs';
import { loadPlugins } from './plugins.mjs';
import { checkUpdates } from './update.mjs';
import { installFromSource, installArchive, uninstall, rebuild } from './installer.mjs';
import { getMarketplace } from './marketplace.mjs';
import { tmpdir } from 'node:os';

const DIR = dirname(fileURLToPath(import.meta.url));
// Light-bulb mark served at /brand/bulb.svg (favicon + empty-state image). The
// header wordmark now lives in the React bundle, not injected here.
const BULB_FILE = readFileSync(join(DIR, 'brand/bulb-full.svg'), 'utf8');

export function startServer({ port = 4321 } = {}) {
  // Load tool plugins; reloadable so install/uninstall picks up changes without
  // a server restart (the client rebuild + reload picks up the new bundle).
  let pluginsReady = loadPlugins();
  const reloadPlugins = () => { pluginsReady = loadPlugins(); return pluginsReady; };
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
    // Tool registry: the rail + tool head render from these manifests. Each
    // carries an `enabled` flag (WP-style activate/deactivate; instant, no rebuild).
    if (url.pathname === '/api/plugins') {
      const disabled = readDisabled();
      json(res, 200, { plugins: (await pluginsReady).map((p) => ({ ...p.manifest, enabled: !disabled.has(p.manifest.id) })) });
      return;
    }
    // Activate / deactivate a tool. Instant - just toggles a flag, no rebuild.
    if (url.pathname === '/api/plugins/toggle' && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req) || '{}');
        const id = (body.id || '').trim();
        if (!id) throw new Error('missing id');
        if (id === 'changelog' && !body.enabled) throw new Error('the core Changelog tool cannot be deactivated');
        const set = readDisabled();
        if (body.enabled) set.delete(id); else set.add(id);
        writeDisabled(set);
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 200, { ok: false, error: err.message });
      }
      return;
    }
    // Free update check: newer GitHub Release than the installed plugin version.
    if (url.pathname === '/api/updates') {
      try {
        json(res, 200, { updates: await checkUpdates(await pluginsReady) });
      } catch (err) {
        json(res, 200, { updates: [], error: err.message });
      }
      return;
    }

    // Curated/verified marketplace catalog to browse + install from.
    if (url.pathname === '/api/marketplace') {
      try {
        json(res, 200, await getMarketplace());
      } catch (err) {
        json(res, 200, { tools: [], error: err.message });
      }
      return;
    }

    // Install a tool from a GitHub repo the user typed. Runs third-party code
    // after the rebuild - only ever triggered by the user's own action here.
    if (url.pathname === '/api/plugins/install' && req.method === 'POST') {
      try {
        const source = (JSON.parse(await readBody(req) || '{}').source || '').trim();
        const manifest = await installFromSource(source);
        await rebuild();
        await reloadPlugins();
        json(res, 200, { ok: true, id: manifest.id, name: manifest.name });
      } catch (err) {
        json(res, 200, { ok: false, error: err.message });
      }
      return;
    }

    // Upload a tool as a .zip (raw body). Same install path as above.
    if (url.pathname === '/api/plugins/upload' && req.method === 'POST') {
      try {
        const buf = await readBodyBuffer(req);
        if (!buf.length) throw new Error('empty upload');
        const zip = join(mkdtempSync(join(tmpdir(), 'forge-up-')), 'upload.zip');
        writeFileSync(zip, buf);
        const manifest = installArchive(zip, 'zip');
        await rebuild();
        await reloadPlugins();
        json(res, 200, { ok: true, id: manifest.id, name: manifest.name });
      } catch (err) {
        json(res, 200, { ok: false, error: err.message });
      }
      return;
    }

    if (url.pathname === '/api/plugins/uninstall' && req.method === 'POST') {
      try {
        const id = (JSON.parse(await readBody(req) || '{}').id || '').trim();
        if (id === 'changelog') throw new Error('the core Changelog tool cannot be removed');
        uninstall(id);
        await rebuild();
        await reloadPlugins();
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 200, { ok: false, error: err.message });
      }
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
    const disabledNow = readDisabled();
    for (const p of plugins) {
      if (disabledNow.has(p.manifest.id)) continue; // deactivated tools serve nothing
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

// Deactivated tools: their id is listed here; they stay installed but the shell
// hides them and their server routes are skipped. Toggling is instant (no build).
function disabledPath() { return join(dirname(cookiePath()), 'disabled-tools.json'); }
function readDisabled() {
  try { return new Set(JSON.parse(readFileSync(disabledPath(), 'utf8')).disabled || []); }
  catch { return new Set(); }
}
function writeDisabled(set) {
  const p = disabledPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ disabled: [...set] }), { mode: 0o600 });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
  });
}

// Binary body reader for the .zip upload (up to 25 MB).
function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 25e6) { req.destroy(); reject(new Error('upload too large (max 25 MB)')); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Minimal HTML shell: the React bundle (dist/main.js) renders everything into
// #root. Brand SVGs + all UI live in the bundle, not injected here.
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Forge · UnleashWP</title>
<link rel="icon" type="image/svg+xml" href="/brand/bulb.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/main.css">
</head>
<body>
<div id="root"></div>
<script src="/assets/main.js" defer></script>
</body>
</html>`;
