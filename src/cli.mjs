import { authenticated } from './github.mjs';
import { generate } from './report.mjs';
import { fetchTicketDetails, resolveCookie } from './trac.mjs';
import { applyDeepDetails } from './aggregate.mjs';
import { toMarkdown, toPost } from './format.mjs';

const HELP = `uwp (wp-release-helper) — summarize WordPress Core & Gutenberg changes for a release post.

Usage:
  uwp --since <date> --until <date> [options]
  uwp <since> <until> [options]
  uwp serve [--port <n>]            Open the browser UI.
  uwp cookie-import <browser>       Import the wordpress.org cookie from a local
                                    browser (chrome|safari|firefox|edge, macOS).

Options:
  --since <date>        Start of window (YYYY-MM-DD or ISO 8601). Required.
  --until <date>        End of window (YYYY-MM-DD or ISO 8601). Required.
  --milestone <x.y>     Release milestone; defaults Gutenberg branch to wp/<x.y>.
  --gb-branch <ref>     Gutenberg branch (default: wp/<milestone> or trunk).
  --core-branch <ref>   wordpress-develop branch (default: trunk).
  --no-labels           Skip Gutenberg [Type] label grouping (fewer API calls).
  --no-dev-notes        Skip the Core dev-notes tracker; leave Core flat.
  --deep                Read full Trac ticket descriptions (one cookie-gated CSV
                        request); fills Uncategorized + adds descriptions to JSON.
                        Needs a WordPress.org cookie (see --trac-cookie).
  --trac-cookie <file>  File holding the WPORG_TRAC_COOKIE value for --deep
                        (or set the WPORG_TRAC_COOKIE env var).
  --post                Emit a fill-in release-post template (headline, count
                        line, source links, highlights placeholder + changelog).
  --json                Emit raw JSON instead of Markdown.
  -h, --help            Show this help.

Sources:
  Gutenberg  -> github.com/WordPress/gutenberg
  Core       -> github.com/WordPress/wordpress-develop (git mirror of Core SVN)
  Core grouping -> WordPress/Documentation-Issue-Tracker dev-notes (cookie-free).

Example:
  uwp --since 2026-07-15 --until 2026-07-22 --milestone 7.1
  uwp serve
`;

export async function run(argv) {
  const args = parseArgs(argv);

  if (args._[0] === 'serve') {
    const { startServer } = await import('./server.mjs');
    return startServer({ port: Number(args.port) || 4321 });
  }

  if (args._[0] === 'cookie-import') {
    const { importWporgCookie } = await import('./cookie-import.mjs');
    const { saveCookie, validateCookie } = await import('./trac.mjs');
    const browser = args.browser ?? args._[1];
    if (!browser) throw new Error('usage: uwp cookie-import <chrome|safari|firefox|edge>');
    const cookie = importWporgCookie(browser); // value stays local; never printed
    const path = saveCookie(cookie);
    console.log(`Imported wporg_logged_in + wporg_sec from ${browser}, saved to ${path}.`);
    const ok = await validateCookie(cookie);
    console.log(ok
      ? 'Verified — Trac reachable.'
      : 'Saved, but Trac rejected it (expired session or bot wall). The tool still runs cookie-free.');
    return;
  }

  if (args.help) {
    console.log(HELP);
    return;
  }

  const since = args.since ?? args._[0];
  const until = args.until ?? args._[1];
  if (!since || !until) {
    console.log(HELP);
    throw new Error('--since and --until are required');
  }

  if (!authenticated()) {
    console.error('uwp: no GitHub token (gh not logged in) — using 60 req/h anonymous limit.');
  }

  const { meta, report } = await generate({
    since,
    until,
    milestone: args.milestone ?? null,
    gbBranch: args['gb-branch'],
    coreBranch: args['core-branch'],
    labels: args.labels !== false,
    devNotes: args['dev-notes'] !== false,
  });

  if (meta.trackerMissing) {
    console.error(`uwp: no dev-notes tracker for ${meta.milestone} — Core stays flat (use --deep or the wporg-context MCP to group).`);
  }

  if (args.deep) {
    const cookie = resolveCookie({ cookieFile: args['trac-cookie'] });
    const details = await fetchTicketDetails({ milestone: meta.milestone, cookie });
    applyDeepDetails(report, details);
    console.error(`uwp: --deep read ${details.size} Trac tickets (with descriptions).`);
  }

  if (args.json) {
    console.log(JSON.stringify({ meta, ...report }, null, 2));
  } else if (args.post) {
    console.log(toPost(report, meta));
  } else {
    console.log(toMarkdown(report, meta));
  }
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
