// Frontend plugin installer (self-hosted). Installs a Forge plugin from a GitHub
// repo URL or an uploaded .zip into plugins/<id>, then the caller rebuilds the
// bundle. SECURITY: this runs third-party code (the tool's server.mjs + client)
// in the user's own environment - only ever call it for a source the user
// explicitly chose (a URL they typed, a file they picked). Never from a source
// that came from page content or another tool. A plugin repo/zip has plugin.json
// at its root (one tool per repo).
import { existsSync, readFileSync, rmSync, cpSync, mkdtempSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { userPluginsDir, isBundledPlugin } from './plugins.mjs';
import { readDisabled } from './disabled-tools.mjs';
import { latestRelease } from './update.mjs';
import { resolveToken } from './connectors/github-token.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
// Community plugins install into the user's config dir, NOT the package. So an
// app update (npm i -g / npx replaces the install dir) never deletes them.
const TOOLS = userPluginsDir();
const ID_RE = /^[a-z0-9][a-z0-9-]*$/; // no dots/slashes/underscores -> no path traversal

export function parseSource(source) {
  const s = String(source || '').trim();
  let m = /^github:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(s);
  if (m) return { owner: m[1], repo: m[2] };
  m = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(s);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

async function downloadTarball(owner, repo, ref) {
  const tmp = mkdtempSync(join(tmpdir(), 'forge-dl-'));
  const out = join(tmp, 'src.tar.gz');
  const r = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/${ref}`);
  if (r.ok) {
    writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    return out;
  }
  throw new Error(`could not download ${owner}/${repo} at ${ref}`);
}

async function downloadBranchTip(owner, repo) {
  for (const ref of ['refs/heads/main', 'refs/heads/master']) {
    try {
      return await downloadTarball(owner, repo, ref);
    } catch { /* try next */ }
  }
  throw new Error(`could not download ${owner}/${repo} (no main/master branch, or repo is private)`);
}

async function downloadReleaseTag(owner, repo, tag) {
  const bare = String(tag).replace(/^v/, '');
  for (const t of [tag, `v${bare}`, bare]) {
    try {
      return await downloadTarball(owner, repo, `refs/tags/${t}`);
    } catch { /* try next */ }
  }
  throw new Error(`could not download release ${tag} of ${owner}/${repo}`);
}

function extract(archivePath, kind) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-ex-'));
  const res = kind === 'zip'
    ? spawnSync('unzip', ['-oq', archivePath, '-d', dir])
    : spawnSync('tar', ['-xzf', archivePath, '-C', dir]);
  if (res.status !== 0) throw new Error(`extract failed: ${(res.stderr || '').toString().slice(0, 200)}`);
  return dir;
}

// Find the folder that holds plugin.json: the extract root, or a single top-level
// subdir (GitHub tarballs nest everything under <repo>-<ref>/).
function locatePluginDir(extractDir) {
  if (existsSync(join(extractDir, 'plugin.json'))) return extractDir;
  const subs = readdirSync(extractDir).filter((n) => statSync(join(extractDir, n)).isDirectory());
  const withManifest = subs.filter((n) => existsSync(join(extractDir, n, 'plugin.json')));
  if (withManifest.length === 1) return join(extractDir, withManifest[0]);
  if (withManifest.length === 0) throw new Error('no plugin.json found in the archive');
  throw new Error('archive holds more than one tool; expected one plugin.json at the root');
}

function readManifest(pluginDir) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8')); }
  catch (err) { throw new Error('invalid plugin.json: ' + err.message); }
  if (!manifest.id || !ID_RE.test(manifest.id)) throw new Error('manifest id missing or invalid (lowercase letters, digits, hyphens)');
  if (!manifest.name) throw new Error('manifest is missing "name"');
  // A plugin needs at least one of: a server.mjs (MCP tools / routes / skills;
  // works on every install method) or a client.jsx (browser UI). client.jsx alone
  // is NOT required: community plugins install into the user config dir, whose UIs
  // aren't bundled at build time, so a UI-only plugin can't render there anyway.
  // requiring it would reject the very MCP-only plugins that do work.
  if (!existsSync(join(pluginDir, 'server.mjs')) && !existsSync(join(pluginDir, 'client.jsx'))) {
    throw new Error('a plugin needs a server.mjs (MCP tools/routes/skills) or a client.jsx (browser UI)');
  }
  return manifest;
}

// Extract an archive already on disk and install it. Split out from the download
// so it is unit-testable without the network. toolsDir override is for tests.
export function installArchive(archivePath, kind, { toolsDir = TOOLS, expectId } = {}) {
  const extracted = extract(archivePath, kind);
  const pluginDir = locatePluginDir(extracted);
  const manifest = readManifest(pluginDir);

  // A community plugin must not take a bundled tool's id. loadPlugins() scans
  // the user dir after the bundled one and the last writer wins, so the copy
  // would answer the shipped tool's routes, MCP tools and skills. It would also
  // be invisible and permanent: syncCommunityUi skips bundled ids, so the real
  // panel keeps rendering, and uninstall() refuses bundled ids, so the app
  // cannot remove it again.
  if (isBundledPlugin(manifest.id)) {
    throw new Error(`"${manifest.id}" is the id of a tool that ships with the app - a plugin cannot take it`);
  }

  // Updating pulls from the plugin's own updateSource, so without this an
  // installed plugin could hand back a package claiming a different id and take
  // over that tool, with no fresh decision by the user.
  if (expectId && manifest.id !== expectId) {
    throw new Error(`update for "${expectId}" declares id "${manifest.id}" - refusing`);
  }

  const dest = join(toolsDir, manifest.id);
  mkdirSync(toolsDir, { recursive: true }); // the user plugins dir may not exist yet
  rmSync(dest, { recursive: true, force: true }); // reinstall / update overwrites
  cpSync(pluginDir, dest, { recursive: true });
  return manifest;
}

export async function installFromSource(source, { expectId, releaseTag } = {}) {
  const parsed = parseSource(source);
  if (!parsed) throw new Error('give a GitHub repo (github:owner/repo or https://github.com/owner/repo)');
  let tarball;
  if (releaseTag) {
    tarball = await downloadReleaseTag(parsed.owner, parsed.repo, releaseTag);
  } else if (expectId) {
    // Update path: download the latest GitHub Release tag, never the branch tip.
    const { token } = resolveToken();
    const rel = await latestRelease(parsed.owner, parsed.repo, token);
    if (!rel || !rel.tag) throw new Error(`no GitHub release found for ${parsed.owner}/${parsed.repo}`);
    tarball = await downloadReleaseTag(parsed.owner, parsed.repo, rel.tag);
  } else {
    tarball = await downloadBranchTip(parsed.owner, parsed.repo);
  }
  return installArchive(tarball, 'tar', { expectId });
}

export function uninstall(id, { toolsDir = TOOLS } = {}) {
  if (!ID_RE.test(String(id || ''))) throw new Error('invalid tool id');
  // Bundled tools ship with the app and would return on the next update. Refuse.
  if (isBundledPlugin(id)) throw new Error('bundled tools ship with the app and can\'t be removed');
  const dest = join(toolsDir, id);
  if (!existsSync(dest) || !statSync(dest).isDirectory()) throw new Error('tool not installed');
  rmSync(dest, { recursive: true, force: true });
}

// Stage community client.jsx files where webpack can see them. User installs
// live in the config dir; webpack contexts cannot leave the project, so the
// registry reads plugins-community/ and this sync fills it before every build.
// Bundled ids are skipped. A community plugin must not shadow a shipped UI.
export function syncCommunityUi({
  toolsDir = TOOLS,
  staging = join(ROOT, 'plugins-community'),
  disabled = readDisabled(),
} = {}) {
  // Clear stale stagings (an uninstalled plugin must lose its panel).
  if (existsSync(staging)) {
    for (const entry of readdirSync(staging)) {
      if (entry === 'README.md') continue;
      rmSync(join(staging, entry), { recursive: true, force: true });
    }
  } else {
    mkdirSync(staging, { recursive: true });
  }
  if (!existsSync(toolsDir)) return [];
  const staged = [];
  // Deactivated tools are not staged. The client registry uses an eager webpack
  // context, so anything staged has its module body executed in the browser at
  // every page load, same-origin, whether or not the shell renders it.
  for (const id of readdirSync(toolsDir)) {
    if (!ID_RE.test(id) || isBundledPlugin(id) || disabled.has(id)) continue;
    const client = join(toolsDir, id, 'client.jsx');
    if (!existsSync(client)) continue;
    mkdirSync(join(staging, id), { recursive: true });
    cpSync(client, join(staging, id, 'client.jsx'));
    staged.push(id);
  }
  return staged;
}

// True when webpack is available (dev/git checkout). Published npm installs ship
// a prebuilt dist/ and do not include webpack in dependencies.
export function webpackAvailable() {
  return existsSync(join(ROOT, 'node_modules', 'webpack', 'bin', 'webpack.js'));
}

// Rebuild the browser bundle so a newly installed/removed tool shows up. Resolves
// with { rebuilt, skipped?, warning? }. MCP-only plugins need no webpack; a UI
// plugin on a published install returns skipped with a warning instead of failing
// the whole install.
export function rebuild() {
  const staged = syncCommunityUi();
  if (!webpackAvailable()) {
    if (staged.length === 0) {
      return Promise.resolve({ rebuilt: false, skipped: true, warning: null });
    }
    return Promise.resolve({
      rebuilt: false,
      skipped: true,
      warning: 'Plugin installed; MCP tools are live. Rebuilding the browser UI needs a dev checkout (webpack is not shipped on npm install). Reload to pick up server-side tools.',
    });
  }
  return new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', 'build'], { cwd: ROOT });
    let err = '';
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => (code === 0
      ? resolve({ rebuilt: true, skipped: false, warning: null })
      : reject(new Error('build failed: ' + err.slice(-300)))));
    p.on('error', reject);
  });
}
