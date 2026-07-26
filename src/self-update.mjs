// One-click self-update for the whole app, driven from the Updates tab. How we
// update depends on how AI Forge was installed:
//   • git checkout (a cloned repo, `.git` present) — `git pull` + `npm install`
//     + `npm run build`.
//   • global npm install (`npm i -g @unleashwp/ai-forge`) — `npm i -g …@latest`;
//     the published package already ships a built `dist/`, so no rebuild.
//   • npx (`npx @unleashwp/ai-forge@latest`) — already the latest each run;
//     nothing to update.
// Commands are fixed (no user input), so there is nothing to inject — the same
// trust model as the existing "Register in Claude Code" button. The client
// bundle (dist/main.js) is served no-store, so a page reload picks up UI and
// tool changes immediately; only server-side code needs an AI Forge restart.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Package root = the folder above src/ (this file lives in src/).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// How was this copy installed? Path shape + a .git marker tell us. A copy under
// node_modules is either a project dependency (a host package.json sits above
// node_modules → 'local', not self-updatable from here) or a global install (npm
// prefix, no host package.json → 'global').
export function detectInstall() {
  if (/[\\/](_npx|\.npm[\\/]_npx)[\\/]/.test(ROOT)) return 'npx';
  if (existsSync(join(ROOT, '.git'))) return 'git';
  if (/[\\/]node_modules[\\/]@unleashwp[\\/]ai-forge$/.test(ROOT)) {
    return existsSync(join(ROOT, '..', '..', '..', 'package.json')) ? 'local' : 'global';
  }
  return 'global';
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd: ROOT, timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; reject(err); } else resolve(stdout);
    });
  });
}

// Update in place. Returns { ok, method, restart, message } — restart flags that
// server-side changes only apply after AI Forge is restarted (the client reloads
// on its own). On failure: { ok:false, method, error }.
export async function runSelfUpdate() {
  const method = detectInstall();
  try {
    if (method === 'npx') {
      return { ok: true, method, restart: false, message: 'npx always runs the latest — nothing to update.' };
    }
    if (method === 'local') {
      // A project dependency: updating the global copy wouldn't touch it, so don't
      // silently mutate the user's environment — tell them where to update.
      return { ok: true, method, restart: false, message: 'AI Forge is installed as a project dependency — update it with `npm update @unleashwp/ai-forge` in that project.' };
    }
    if (method === 'git') {
      await run('git', ['pull', '--ff-only']);
      await run('npm', ['install', '--no-audit', '--no-fund']);
      await run('npm', ['run', 'build']);
      return { ok: true, method, restart: true };
    }
    // global npm install — the published package ships a built dist/.
    await run('npm', ['install', '-g', '@unleashwp/ai-forge@latest', '--no-audit', '--no-fund']);
    return { ok: true, method, restart: true };
  } catch (err) {
    const stderr = String(err.stderr || '').trim();
    return { ok: false, method, error: err.code === 'ENOENT'
      ? `The ${method === 'git' ? 'git' : 'npm'} command isn't on your PATH — update from a terminal instead.`
      : stderr.slice(-500) || err.message };
  }
}
