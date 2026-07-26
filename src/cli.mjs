import { resolveCookie } from './connectors/wporg-cookie.mjs';

// WordPress.org is mandatory for any plugin data command: without a logged-in
// session Trac serves its bot wall and contributor + Core ticket counts come back
// inaccurate. Throw a clear, actionable error before running one. The connect path
// (`cookie-import`) and `serve`/`mcp`/`update`/`skills`/help are handled earlier
// and stay open, so the user can always reach the way to connect.
function requireWporg() {
  if (resolveCookie()) return;
  throw new Error(
    'wordpress.org connection required — AI Forge needs it or contributor and Core ticket counts are inaccurate.\n' +
    'Connect once, then re-run your command:\n' +
    '  uwp-ai-forge cookie-import <chrome|safari|firefox|edge>\n' +
    'or open the app and sign in to WordPress.org:\n' +
    '  uwp-ai-forge serve   (→ http://localhost:4321, Setup)\n' +
    'or set the WPORG_TRAC_COOKIE environment variable.'
  );
}

const HELP = `uwp-ai-forge — a hub for WordPress release and dev tooling. Each plugin adds a feature.
(short alias: uwp)

Usage:
  uwp-ai-forge serve [--port <n>]       Open the browser UI.
  uwp-ai-forge update                   Update AI Forge to the latest version.
  uwp-ai-forge mcp                      Run as an MCP server (stdio) for Claude Code /
                                        Codex: claude mcp add uwp-ai-forge -- uwp-ai-forge mcp
  uwp-ai-forge skills [<name>]          List the AI skills plugins provide, or print one.
  uwp-ai-forge cookie-import <browser>  Import the wordpress.org cookie from a local
                                        browser (chrome|safari|firefox|edge, macOS).
  uwp-ai-forge <plugin> [options]       Run a plugin's own command (listed below).
  -h, --help                            Show this help.

Example:
  uwp-ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
`;

export async function run(argv) {
  const args = parseArgs(argv);

  if (args._[0] === 'serve') {
    const { startServer } = await import('./server.mjs');
    return startServer({ port: Number(args.port) || 4321 });
  }

  if (args._[0] === 'mcp') {
    const { startMcpServer } = await import('./mcp-server.mjs');
    return startMcpServer();
  }

  // `uwp-ai-forge update` — self-update the whole app (wp-cli style). Runs the
  // right command for how this copy was installed; see self-update.mjs.
  if (args._[0] === 'update') {
    const { runSelfUpdate } = await import('./self-update.mjs');
    console.log('Updating AI Forge…');
    const r = await runSelfUpdate();
    if (!r.ok) throw new Error(r.error);
    if (r.message) console.log(r.message); // npx / project-dependency: nothing to run here
    else console.log('Success: AI Forge is up to date.' + (r.restart ? ' Restart any running `uwp-ai-forge serve` or MCP to load server changes.' : ''));
    return;
  }

  if (args._[0] === 'skills') {
    const { loadPlugins } = await import('./plugins.mjs');
    const skills = (await loadPlugins()).flatMap((p) => p.skills || []);
    const name = args._[1];
    if (!name) {
      if (!skills.length) { console.log('No skills installed.'); return; }
      console.log('Skills (AI instructions the plugins provide):\n');
      for (const s of skills) console.log(`  ${s.name.padEnd(24)} ${s.description || ''}`);
      console.log('\nRun `uwp-ai-forge skills <name> [--arg value]` to print one.');
      return;
    }
    const skill = skills.find((s) => s.name === name);
    if (!skill) throw new Error(`unknown skill: ${name} (run \`uwp-ai-forge skills\` to list)`);
    console.log(skill.build ? skill.build(args) : (skill.instructions || ''));
    return;
  }

  if (args._[0] === 'cookie-import') {
    const { importWporgCookie } = await import('./cookie-import.mjs');
    const { saveCookie, validateCookie } = await import('./connectors/wporg-cookie.mjs');
    const browser = args.browser ?? args._[1];
    if (!browser) throw new Error('usage: uwp-ai-forge cookie-import <chrome|safari|firefox|edge>');
    const cookie = importWporgCookie(browser); // value stays local; never printed
    const path = saveCookie(cookie);
    console.log(`Imported wporg_logged_in + wporg_sec from ${browser}, saved to ${path}.`);
    const ok = await validateCookie(cookie);
    console.log(ok
      ? 'Verified - Trac reachable.'
      : 'Saved, but Trac rejected it (expired session or bot wall). The tool still runs cookie-free.');
    return;
  }

  // Plugin terminal commands: `uwp <command> …` dispatches to a tool that
  // exports `commands` from its server.mjs. Only word-like first args can be a
  // command, so date positionals (`uwp 2026-07-15 …`) skip the plugin load.
  const sub = args._[0];
  if (sub && /^[a-z][a-z0-9-]*$/.test(sub) && sub !== 'serve' && sub !== 'cookie-import') {
    const { loadPlugins } = await import('./plugins.mjs');
    for (const p of await loadPlugins()) {
      const cmd = (p.commands || []).find((c) => c.name === sub);
      if (cmd) { requireWporg(); await cmd.run(args, { log: console.log, error: console.error }); return; }
    }
  }

  // Bare `ai-forge` shows the branded welcome; `-h`/`--help` shows full usage.
  if (!args._[0] && !args.help) {
    const { renderWelcome } = await import('./welcome.mjs');
    console.log(renderWelcome());
    return;
  }
  if (args.help || !args._[0]) {
    console.log(HELP);
    const { loadPlugins } = await import('./plugins.mjs');
    const cmds = (await loadPlugins()).flatMap((p) => p.commands || []);
    if (cmds.length) {
      console.log('Plugin commands:');
      for (const c of cmds) console.log(`  uwp-ai-forge ${c.name.padEnd(16)} ${c.summary || ''}`);
      console.log('');
    }
    return;
  }

  console.log(HELP);
  throw new Error(`unknown command: ${args._[0]} (run \`uwp-ai-forge -h\`)`);
}

// Minimal flag parser: --key value, --key=value, --flag, --no-flag, and positionals.
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      args.help = true;
    } else if (a === '--json') {
      args.json = true;
    } else if (a === '--post') {
      args.post = true;
    } else if (a === '--deep') {
      args.deep = true;
    } else if (a === '--no-labels') {
      args.labels = false;
    } else if (a === '--no-dev-notes') {
      args['dev-notes'] = false;
    } else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        args[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next != null && !next.startsWith('--')) {
          args[a.slice(2)] = next;
          i++;
        } else {
          args[a.slice(2)] = true;
        }
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}
