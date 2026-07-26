import { commits, labelsFor } from './github-queries.mjs';
import { parseCommit } from './parse.mjs';
import { fetchTracker } from './devnotes.mjs';
import { buildReport } from './aggregate.mjs';

export const GB_REPO = 'WordPress/gutenberg';
export const CORE_REPO = 'WordPress/wordpress-develop';

// Core pipeline shared by the CLI and the browser server.
// Returns { meta, report }. `onStep` (optional) reports progress: 'commits',
// 'labels', 'tracker', 'done'.
export async function generate(opts, onStep = () => {}) {
  const since = normDate(opts.since, false);
  const until = normDate(opts.until, true);
  if (!since || !until) throw new Error('since and until are required');

  const milestone = opts.milestone || null;
  const gbBranch = opts.gbBranch || (milestone ? `wp/${milestone}` : 'trunk');
  const coreBranch = opts.coreBranch || 'trunk';
  const wantLabels = opts.labels !== false;
  const wantDevNotes = opts.devNotes !== false;

  onStep('commits');
  const [gbRaw, coreRaw] = await Promise.all([
    commits(GB_REPO, gbBranch, since, until),
    commits(CORE_REPO, coreBranch, since, until),
  ]);
  // Drop release plumbing so the count is the EXACT number of real changes, no
  // more and no less. Plumbing is an explicit allow-list of the versioning /
  // packaging commits both repos land - version bumps, changelog-file updates,
  // the "chore(release)" publish, the "WordPress 7.1 Beta 3." bundle tags, and
  // reverts of those. Everything else counts, including a rare direct-push change
  // with no PR ref (e.g. a backport onto wp/7.1). Keeping this a deny-list of
  // known plumbing - rather than "no PR number" - means no real change is ever
  // silently dropped; an unrecognised commit shows up in the list to be seen.
  const isPlumbing = (c) => {
    const s = c.subject;
    return /^WordPress\s+\d/i.test(s)                                   // "WordPress 7.1 Beta 3."
      || /version bump\.?\s*$/i.test(s)                                  // "Post WordPress 7.1 Beta 3 version bump."
      || /^Bump\s+(plugin\s+|the\s+)?version\b/i.test(s)                 // "Bump plugin version to 23.6.0"
      || /^Update\s+Changelog\b/i.test(s)                               // "Update Changelog for 23.6.0"
      || /^Update\s+changelog\s+files\b/i.test(s)                       // "Update changelog files"
      || /^chore\(release\)/i.test(s)                                    // "chore(release): publish"
      || /^add pr link to changelog/i.test(s)                           // "add pr link to changelog"
      || /^Revert\s+"?(Bump\s+(plugin\s+|the\s+)?version|Update\s+Changelog|add pr link to changelog)/i.test(s);
  };
  // Core commits on the SVN mirror all carry a changeset; anything without one is
  // a mirror artifact, not a change.
  const gb = gbRaw.map(parseCommit).filter((c) => !isPlumbing(c));
  const core = coreRaw.map(parseCommit).filter((c) => c.changeset && !isPlumbing(c));

  let gbLabels = null;
  if (wantLabels) {
    const prNums = [...new Set(gb.map((c) => c.pr).filter(Boolean))];
    if (prNums.length) {
      onStep('labels');
      gbLabels = await labelsFor(GB_REPO, prNums);
    }
  }

  let tracker = null;
  let trackerMissing = false;
  if (milestone && wantDevNotes) {
    onStep('tracker');
    tracker = await fetchTracker(milestone);
    trackerMissing = !tracker;
  }

  const report = buildReport(gb, core, gbLabels, tracker);
  const meta = { since, until, milestone, gbBranch, coreBranch, trackerMissing };
  onStep('done');
  return { meta, report };
}

// Date-only -> full-day bounds; ISO strings pass through untouched. A shape-valid
// but impossible date (2026-13-45) is rejected here with a clear message instead
// of being forwarded to GitHub and surfacing as a raw 422.
export function normDate(v, isEnd) {
  if (!v || v === true) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
      throw new Error(`invalid date: ${v} (use YYYY-MM-DD)`);
    }
    return `${v}T${isEnd ? '23:59:59' : '00:00:00'}Z`;
  }
  return v;
}
