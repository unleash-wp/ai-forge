import { commits, labelsFor } from './github.mjs';
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
  // Keep only substantive changes so the rendered list and the headline count
  // agree. Gutenberg is 100% PR-merged; its non-PR commits are release plumbing
  // (version bumps, "Update Changelog", SECURITY.md). Every Core commit on the
  // SVN mirror carries a changeset; anything without one is a mirror artifact.
  // Both repos also land release-packaging commits ("WordPress 7.1 Beta 3.", the
  // "Post ... version bump.") that carry a changeset but are not changes - the
  // Beta/RC bundles. Drop those so the count reflects real work, not the release.
  const isPackaging = (c) => /^WordPress\s+\d/i.test(c.subject)
    || /version bump\.?\s*$/i.test(c.subject)
    || /^Bump\s+(the\s+)?version\b/i.test(c.subject);
  const gb = gbRaw.map(parseCommit).filter((c) => c.pr && !isPackaging(c));
  const core = coreRaw.map(parseCommit).filter((c) => c.changeset && !isPackaging(c));

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

// Date-only -> full-day bounds; ISO strings pass through untouched.
export function normDate(v, isEnd) {
  if (!v || v === true) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T${isEnd ? '23:59:59' : '00:00:00'}Z`;
  return v;
}
