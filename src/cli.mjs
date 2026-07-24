import { commits, labelsFor, authenticated } from './github.mjs';
import { parseCommit } from './parse.mjs';
import { fetchTracker } from './devnotes.mjs';
import { buildReport } from './aggregate.mjs';
import { toMarkdown } from './format.mjs';

const GB_REPO = 'WordPress/gutenberg';
const CORE_REPO = 'WordPress/wordpress-develop';

const HELP = `wp-release-helper — summarize WordPress Core & Gutenberg changes for a release post.

Usage:
  wp-release-helper --since <date> --until <date> [options]
  wp-release-helper <since> <until> [options]

Options:
  --since <date>        Start of window (YYYY-MM-DD or ISO 8601). Required.
  --until <date>        End of window (YYYY-MM-DD or ISO 8601). Required.
  --milestone <x.y>     Release milestone; defaults Gutenberg branch to wp/<x.y>.
  --gb-branch <ref>     Gutenberg branch (default: wp/<milestone> or trunk).
  --core-branch <ref>   wordpress-develop branch (default: trunk).
  --no-labels           Skip Gutenberg [Type] label grouping (fewer API calls).
  --no-dev-notes        Skip the Core dev-notes tracker; leave Core flat.
  --json                Emit raw JSON instead of Markdown.
  -h, --help            Show this help.

Sources:
  Gutenberg  -> github.com/WordPress/gutenberg
  Core       -> github.com/WordPress/wordpress-develop (git mirror of Core SVN)
  Trac ticket component/milestone grouping is added by the SKILL via the
  Automattic mcp-context-wporg MCP server (Trac is bot-walled for scripts).

Example:
  wp-release-helper --since 2026-07-15 --until 2026-07-22 --milestone 7.1
`;

export async function run(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP);
    return;
  }

  const since = normDate(args.since ?? args._[0], false);
  const until = normDate(args.until ?? args._[1], true);
  if (!since || !until) {
    console.log(HELP);
    throw new Error('--since and --until are required');
  }

  const milestone = args.milestone ?? null;
  const gbBranch = args['gb-branch'] ?? (milestone ? `wp/${milestone}` : 'trunk');
  const coreBranch = args['core-branch'] ?? 'trunk';

  if (!authenticated) {
    console.error('wp-release-helper: no GitHub token (gh not logged in) — using 60 req/h anonymous limit.');
  }

  const [gbRaw, coreRaw] = await Promise.all([
    commits(GB_REPO, gbBranch, since, until),
    commits(CORE_REPO, coreBranch, since, until),
  ]);

  const gb = gbRaw.map(parseCommit);
  const core = coreRaw.map(parseCommit);

  let gbLabels = null;
  if (args.labels !== false) {
    const prNums = [...new Set(gb.map((c) => c.pr).filter(Boolean))];
    if (prNums.length) gbLabels = await labelsFor(GB_REPO, prNums);
  }

  // Preferred Core categorization: the docs-team dev-notes tracker (cookie-free,
  // component + classification tagged). Null when none exists for the milestone.
  let tracker = null;
  if (milestone && args['dev-notes'] !== false) {
    tracker = await fetchTracker(milestone);
    if (!tracker) console.error(`wp-release-helper: no dev-notes tracker for ${milestone} — Core stays flat (use the wporg-context MCP to group).`);
  }

  const report = buildReport(gb, core, gbLabels, tracker);
  const meta = { since, until, milestone, gbBranch, coreBranch };

  if (args.json) {
    console.log(JSON.stringify({ meta, ...report }, null, 2));
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

// Date-only -> full-day bounds; ISO strings pass through untouched.
function normDate(v, isEnd) {
  if (!v || v === true) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T${isEnd ? '23:59:59' : '00:00:00'}Z`;
  return v;
}
