// Frontend plugin installer (self-hosted). Installs a Forge tool from a GitHub
// repo URL or an uploaded .zip into tools/<id>, then the caller rebuilds the
// bundle. SECURITY: this runs third-party code (the tool's server.mjs + client)
// in the user's own environment - only ever call it for a source the user
// explicitly chose (a URL they typed, a file they picked). Never from a source
// that came from page content or another tool. A plugin repo/zip has plugin.json
// at its root (one tool per repo).
import { existsSync, readFileSync, rmSync, cpSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const TOOLS = join(ROOT, 'tools');
const ID_RE = /^[a-z0-9][a-z0-9-]*$/; // no dots/slashes/underscores -> no path traversal

export function parseSource(source) {
  const s = String(source || '').trim();
  let m = /^github:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(s);
  if (m) return { owner: m[1], repo: m[2] };
  m = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(s);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

async function downloadTarball(owner, repo) {
  const tmp = mkdtempSync(join(tmpdir(), 'forge-dl-'));
  const out = join(tmp, 'src.tar.gz');
  for (const ref of ['main', 'master']) {
    const r = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${ref}`);
    if (r.ok) {
      writeFileSync(out, Buffer.from(await r.arrayBuffer()));
      return out;
    }
  }
  throw new Error(`could not download ${owner}/${repo} (no main/master branch, or repo is private)`);
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
  if (!existsSync(join(pluginDir, 'client.jsx'))) throw new Error('tool is missing client.jsx');
  return manifest;
}

// Extract an archive already on disk and install it. Split out from the download
// so it is unit-testable without the network. toolsDir override is for tests.
export function installArchive(archivePath, kind, { toolsDir = TOOLS } = {}) {
  const extracted = extract(archivePath, kind);
  const pluginDir = locatePluginDir(extracted);
  const manifest = readManifest(pluginDir);
  const dest = join(toolsDir, manifest.id);
  rmSync(dest, { recursive: true, force: true }); // reinstall / update overwrites
  cpSync(pluginDir, dest, { recursive: true });
  return manifest;
}

export async function installFromSource(source) {
  const parsed = parseSource(source);
  if (!parsed) throw new Error('give a GitHub repo (github:owner/repo or https://github.com/owner/repo)');
  const tarball = await downloadTarball(parsed.owner, parsed.repo);
  return installArchive(tarball, 'tar');
}

export function uninstall(id, { toolsDir = TOOLS } = {}) {
  if (!ID_RE.test(String(id || ''))) throw new Error('invalid tool id');
  const dest = join(toolsDir, id);
  if (!existsSync(dest) || !statSync(dest).isDirectory()) throw new Error('tool not installed');
  rmSync(dest, { recursive: true, force: true });
}

// Rebuild the browser bundle so a newly installed/removed tool shows up.
export function rebuild() {
  return new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', 'build'], { cwd: ROOT });
    let err = '';
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error('build failed: ' + err.slice(-300))));
    p.on('error', reject);
  });
}
