import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { authenticated, saveToken, deleteToken, checkToken, setDisabled } from './connectors/github-token.mjs';
import { startDeviceFlow, pollDeviceFlow } from './connectors/github-device.mjs';
import { resolveCookie, saveCookie, deleteCookie, cookiePath, validateCookie } from './connectors/wporg-cookie.mjs';
import { listConnectors, registerDesktop, unregisterDesktop, SERVER_ID } from './connectors/registry.mjs';
import { VERSION } from './version.mjs';
import { FONT_FACE_CSS } from './fonts.mjs';
import { importWporgCookie } from './cookie-import.mjs';
import { loadPlugins } from './plugins.mjs';

// Fixed argv per agent for the one-click "Register in …" button — Forge runs the
// same `mcp add` command the copy-paste card shows. Whitelisted (no user input in
// the command), so there is nothing to inject. Falls back to copy when the CLI
// isn't on PATH. Claude uses --scope user so it registers globally.
const REGISTER_CMDS = {
  claude: ['claude', 'mcp', 'add', '--scope', 'user', SERVER_ID, '--', 'npx', '-y', '@unleashwp/ai-forge@latest', 'mcp'],
  codex: ['codex', 'mcp', 'add', SERVER_ID, '--', 'npx', '-y', '@unleashwp/ai-forge@latest', 'mcp'],
};
const UNREGISTER_CMDS = {
  claude: ['claude', 'mcp', 'remove', SERVER_ID],
  codex: ['codex', 'mcp', 'remove', SERVER_ID],
};

function execCmd(argv) {
  return new Promise((resolve, reject) => {
    execFile(argv[0], argv.slice(1), { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; reject(err); } else resolve(stdout);
    });
  });
}
import { checkUpdates } from './update.mjs';
import { runSelfUpdate, detectInstall } from './self-update.mjs';
import { installFromSource, installArchive, uninstall, rebuild } from './installer.mjs';
import { wporgAvailable, wporgListTools, wporgExecute, mcpText } from './mcp-wporg.mjs';
import { tmpdir } from 'node:os';

const DIR = dirname(fileURLToPath(import.meta.url));
// Light-bulb mark served at /brand/bulb.svg (favicon + empty-state image). The
// header wordmark now lives in the React bundle, not injected here.
const BULB_FILE = readFileSync(join(DIR, 'brand/bulb-full.svg'), 'utf8');

// State-changing routes that write credentials, install/run code, or self-update.
// The MCP-app internal server (internal:true) is reachable only through the
// forge_api proxy, which a prompt-injected model can call on hosts that don't
// honor the tool's app-only visibility hint — so these are hard-blocked there.
// Setup happens in `serve` (a real browser) or via the MCPB user_config env; the
// tool's read/data routes stay open so the app window still works.
const ADMIN_ROUTES = new Set([
  '/api/github-token', '/api/github-token/enable', '/api/github-token/device/start', '/api/github-token/device/poll',
  '/api/github-token/test', '/api/cookie/test', // credential-validity oracles — setup-only, not needed in the window
  '/api/cookie', '/api/cookie/import',
  '/api/connectors/register', '/api/connectors/unregister',
  '/api/self-update',
  // Proxies arbitrary tool calls to the wporg MCP with the user's live cookie/token —
  // the app never calls it, so keep it off the forge_api-reachable internal server.
  '/api/mcp/execute',
  '/api/plugins/install', '/api/plugins/upload', '/api/plugins/bulk', '/api/plugins/uninstall', '/api/plugins/toggle',
  '/api/installed',
]);

export function startServer({ port = 4321, quiet = false, internal = false } = {}) {
  // Load tool plugins; reloadable so install/uninstall picks up changes without
  // a server restart (the client rebuild + reload picks up the new bundle).
  let pluginsReady = loadPlugins();
  const reloadPlugins = () => { pluginsReady = loadPlugins(); return pluginsReady; };
  const server = createServer(async (req, res) => {
   try {
    const url = new URL(req.url, `http://localhost:${port}`);

    // Anti-DNS-rebinding: only serve requests addressed to a local host. A rebound
    // attacker domain (resolving to 127.0.0.1) still carries its own Host header,
    // so this rejects it before any handler runs.
    if (!isLocalHost(req)) { json(res, 403, { error: 'invalid host' }); return; }

    // Cross-site guard: reject a state-changing request that a browser makes from
    // another origin, so a malicious web page can't POST a wordpress.org session
    // cookie (or a GitHub token, or a plugin install) to this local server. The
    // CLI, the MCP app's loopback proxy and tests are not browsers — they send no
    // Sec-Fetch-Site/Origin and pass. Reads (GET/HEAD) return only public data.
    if (req.method !== 'GET' && req.method !== 'HEAD' && isCrossSite(req)) {
      json(res, 403, { error: 'cross-site request refused' });
      return;
    }

    // App-window backstop (see ADMIN_ROUTES): deny credential/install/self-update
    // routes on the forge_api-reachable internal server.
    if (internal && req.method !== 'GET' && req.method !== 'HEAD' && ADMIN_ROUTES.has(url.pathname)) {
      json(res, 403, { error: 'not available in the app window' });
      return;
    }

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(PAGE);
      return;
    }
    // Webpack bundle (client JS), served from dist/. Styles are Chakra UI
    // (Emotion), injected at runtime — there is no CSS file.
    if (url.pathname === '/assets/main.js') {
      try {
        const body = readFileSync(join(DIR, '..', 'dist', 'main.js'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(body);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
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
        const set = readDisabled();
        // Every tool is a normal plugin — no tool is "core". The only guard is a
        // footgun one: you can't deactivate your last active tool (an empty app).
        if (!body.enabled) {
          const active = (await pluginsReady).filter((p) => !set.has(p.manifest.id));
          if (active.length <= 1 && active.some((p) => p.manifest.id === id)) throw new Error('cannot deactivate your only active tool');
        }
        if (body.enabled) set.delete(id); else set.add(id);
        writeDisabled(set);
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 200, { ok: false, error: err.message });
      }
      return;
    }
    // Bulk management: apply one action (activate/deactivate/update/remove) to
    // many tools, then rebuild once at the end. Won't empty out the last tool.
    if (url.pathname === '/api/plugins/bulk' && req.method === 'POST') {
      try {
        const { action, ids } = JSON.parse(await readBody(req) || '{}');
        const list = Array.isArray(ids) ? ids : [];
        const plugins = await pluginsReady;
        const errors = [];
        let needBuild = false;
        // Track counts so bulk never leaves zero active / zero installed tools.
        const disabled0 = readDisabled();
        const installed = new Set(plugins.map((p) => p.manifest.id));
        const active = new Set([...installed].filter((x) => !disabled0.has(x)));
        for (const id of list) {
          try {
            if (action === 'deactivate') {
              if (active.has(id) && active.size <= 1) { errors.push(id + ': only active tool, skipped'); continue; }
              const set = readDisabled(); set.add(id); writeDisabled(set); active.delete(id);
            } else if (action === 'activate') {
              const set = readDisabled(); set.delete(id); writeDisabled(set); active.add(id);
            } else if (action === 'remove') {
              if (installed.size <= 1) { errors.push(id + ': only installed tool, skipped'); continue; }
              uninstall(id); clearDisabled(id); installed.delete(id); active.delete(id); needBuild = true;
            } else if (action === 'update') {
              const p = plugins.find((x) => x.manifest.id === id);
              if (p && p.manifest.updateSource) { await installFromSource(p.manifest.updateSource); needBuild = true; }
              else errors.push(id + ': no updateSource');
            } else throw new Error('unknown action');
          } catch (e) { errors.push(id + ': ' + e.message); }
        }
        if (needBuild) await rebuild();
        await reloadPlugins();
        json(res, 200, { ok: true, rebuilt: needBuild, errors });
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

    // One-click self-update of the whole app. Runs the fixed update command for
    // how this copy was installed (git / global npm / npx). The client reloads
    // afterwards; server-side changes need an AI Forge restart (restart flag).
    if (url.pathname === '/api/self-update' && req.method === 'POST') {
      json(res, 200, await runSelfUpdate());
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
        if ((await pluginsReady).length <= 1) throw new Error('cannot remove your only installed tool');
        uninstall(id);
        clearDisabled(id); // a fresh reinstall should come back active
        await rebuild();
        await reloadPlugins();
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 200, { ok: false, error: err.message });
      }
      return;
    }
    if (url.pathname === '/brand/bulb.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(BULB_FILE);
      return;
    }

    // Connector status for the setup wizard, derived from the Core registry
    // (never returns the secret values themselves).
    if (url.pathname === '/api/config/status') {
      json(res, 200, {
        version: VERSION,
        installed: isInstalled(),
        install: detectInstall(), // git | global | npx | local — drives the self-updater UI
        connectors: await listConnectors(),
        mcp: { available: wporgAvailable() },
      });
      return;
    }

    // MCP status: is the Automattic mcp-context-wporg server installed + reachable?
    if (url.pathname === '/api/mcp/status') {
      if (!wporgAvailable()) { json(res, 200, { available: false }); return; }
      try {
        const tools = await wporgListTools();
        json(res, 200, { available: true, reachable: true, tools: tools.map((t) => t.name) });
      } catch (err) {
        json(res, 200, { available: true, reachable: false, error: err.message });
      }
      return;
    }

    // Proxy a WordPress.org data call through the MCP (provider: trac|github|make).
    if (url.pathname === '/api/mcp/execute' && req.method === 'POST') {
      try {
        const { provider, tool, params } = JSON.parse(await readBody(req) || '{}');
        if (!provider || !tool) throw new Error('provider and tool are required');
        const result = await wporgExecute(provider, tool, params || {});
        json(res, 200, { ok: !result.isError, data: mcpText(result) });
      } catch (err) {
        json(res, 200, { ok: false, error: err.message });
      }
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
      setDisabled(true); // also suppress the gh CLI auto-detect until reconnected
      json(res, 200, { ok: true });
      return;
    }

    // Reconnect using the detected gh CLI login (one click, no token to paste).
    if (url.pathname === '/api/github-token/enable' && req.method === 'POST') {
      if (process.env.GITHUB_TOKEN) { json(res, 400, { error: 'GITHUB_TOKEN env already provides the token.' }); return; }
      setDisabled(false);
      json(res, 200, { ok: true });
      return;
    }

    // One-click sign-in (OAuth Device Flow): start returns the user code to show;
    // poll exchanges + stores the token server-side and returns only a status.
    if (url.pathname === '/api/github-token/device/start' && req.method === 'POST') {
      if (process.env.GITHUB_TOKEN) { json(res, 400, { error: 'GITHUB_TOKEN env is set and overrides sign-in. Unset it to sign in here.' }); return; }
      json(res, 200, await startDeviceFlow());
      return;
    }

    if (url.pathname === '/api/github-token/device/poll' && req.method === 'POST') {
      json(res, 200, await pollDeviceFlow());
      return;
    }

    // One-click "Register in Claude Code / Codex": run the same mcp-add command the
    // copy card shows. On success the agent has Forge as an MCP server; if its CLI
    // isn't installed we say so and the copy line is the fallback.
    if (url.pathname === '/api/connectors/register' && req.method === 'POST') {
      const agent = (JSON.parse(await readBody(req) || '{}').agent || '').trim();
      // Claude Desktop has no CLI — merge Forge into its JSON config file instead.
      if (agent === 'claude-desktop') {
        try { registerDesktop(); json(res, 200, { ok: true }); }
        catch (err) { json(res, 200, { ok: false, error: err.message }); }
        return;
      }
      const argv = REGISTER_CMDS[agent];
      if (!argv) { json(res, 400, { error: 'unknown agent' }); return; }
      try {
        await execCmd(argv);
        json(res, 200, { ok: true });
      } catch (err) {
        const stderr = String(err.stderr || '');
        // Re-clicking after it's already registered is a success, not an error.
        if (/already\s+(exists|configured|registered)/i.test(stderr)) { json(res, 200, { ok: true }); return; }
        json(res, 200, { ok: false, error: err.code === 'ENOENT'
          ? `The ${agent} CLI isn't on your PATH — copy the command and run it in a terminal instead.`
          : stderr.trim() || err.message });
      }
      return;
    }

    // Disconnect: run the agent's `mcp remove uwp-ai-forge`. Already-gone counts as success.
    if (url.pathname === '/api/connectors/unregister' && req.method === 'POST') {
      const agent = (JSON.parse(await readBody(req) || '{}').agent || '').trim();
      if (agent === 'claude-desktop') {
        try { unregisterDesktop(); json(res, 200, { ok: true }); }
        catch (err) { json(res, 200, { ok: false, error: err.message }); }
        return;
      }
      const argv = UNREGISTER_CMDS[agent];
      if (!argv) { json(res, 400, { error: 'unknown agent' }); return; }
      try {
        await execCmd(argv);
        json(res, 200, { ok: true });
      } catch (err) {
        const stderr = String(err.stderr || '');
        if (/not\s+found|no\s+such|does\s*n.?t\s+exist/i.test(stderr)) { json(res, 200, { ok: true }); return; }
        json(res, 200, { ok: false, error: err.code === 'ENOENT'
          ? `The ${agent} CLI isn't on your PATH.` : stderr.trim() || err.message });
      }
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
          await r.handler(req, res, url, {
            json,
            query: url.searchParams,
            body: async () => JSON.parse((await readBody(req)) || '{}'),
          });
          return;
        }
      }
    }

    res.writeHead(404, { 'Cache-Control': 'no-store' });
    res.end('Not found');
   } catch (err) {
    // Top-level boundary: a throw/rejection in any route (e.g. malformed JSON
    // body, a network blip during device-flow polling) returns a 500 instead of
    // crashing the process under Node's unhandled-rejection default.
    try { if (!res.headersSent) json(res, 500, { error: 'internal error' }); else res.end(); }
    catch { /* response already torn down */ }
   }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`uwp: port ${port} is already in use. Try \`uwp serve --port ${port + 1}\`.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, '127.0.0.1', () => {
    if (quiet) return; // internal server for `uwp mcp` — stdout is reserved for JSON-RPC
    console.log(`uwp browser UI  ->  http://localhost:${port}`);
    if (!authenticated()) console.log('uwp: no gh token. GitHub API limited to 60 req/h (add one in Setup).');
    console.log('Press Ctrl+C to stop.');
  });
  return server;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

// True when a request is a browser request from a different origin. Prefer the
// Fetch Metadata header (every modern browser sends Sec-Fetch-Site); fall back to
// an Origin/Host comparison for older ones. A request with neither header is not
// a browser (CLI, loopback proxy, tests) and is treated as same-origin.
// True when the request's Host is a local address (localhost / 127.0.0.1 / ::1 /
// *.localhost), or absent (non-browser callers). Anything else is a rebind attempt.
function isLocalHost(req) {
  let host = (req.headers.host || '').toLowerCase();
  if (!host) return true;
  host = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}

function isCrossSite(req) {
  const sfs = req.headers['sec-fetch-site'];
  if (sfs) return sfs !== 'same-origin' && sfs !== 'none';
  const origin = req.headers.origin;
  if (origin) {
    try { return new URL(origin).host !== req.headers.host; } catch { return true; }
  }
  // Legacy browsers that send neither Sec-Fetch-Site nor Origin still send a
  // Referer on a cross-site form POST — reject when it points at another host. A
  // caller with no Referer at all is the CLI / loopback proxy / tests (not a
  // browser), so it passes.
  const referer = req.headers.referer;
  if (referer) {
    try { return new URL(referer).host !== req.headers.host; } catch { return true; }
  }
  return false;
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
function clearDisabled(id) { const s = readDisabled(); if (s.delete(id)) writeDisabled(s); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { req.destroy(); reject(new Error('body too large')); } });
    req.on('end', () => resolve(data));
    req.on('error', reject); // socket error mid-body: settle, don't leak the promise
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
<title>UnleashWP AI Forge</title>
<link rel="icon" type="image/svg+xml" href="/brand/bulb.svg">
<style>${FONT_FACE_CSS}</style>
</head>
<body>
<div id="root"></div>
<script src="/assets/main.js" defer></script>
</body>
</html>`;
