import { commits, labelsFor } from './github-queries.mjs';
import { parseCommit } from './parse.mjs';
import { isPlumbing } from '../../../src/lib/wp-parse.mjs';
import { normDate } from '../../../src/lib/wp-commits.mjs';
import { fetchTracker } from './devnotes.mjs';
import { canonicalNames } from '../../../src/lib/wp-profiles.mjs';
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
  // Drop release plumbing so the count is the EXACT number of real changes. The
  // plumbing deny-list (isPlumbing) now lives in Core (src/lib/wp-parse.mjs),
  // shared with other plugins. Core commits on the SVN mirror all carry a
  // changeset; anything without one is a mirror artifact, not a change.
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

  // Merge GitHub-vs-wp.org duplicate identities (GitHub "t-hamano" == wp.org
  // "wildworks") so the props/credits list and count don't double-count a person.
  // Opt-out with identities:false; degrades to the raw union on lookup failure.
  if (opts.identities !== false) {
    report.contributors = await canonicalNames([...report.gutenberg.contributors, ...report.core.contributors]);
    report.totals.contributors = report.contributors.length;
  }

  const meta = { since, until, milestone, gbBranch, coreBranch, trackerMissing };
  onStep('done');
  return { meta, report };
}

// normDate moved to Core (src/lib/wp-commits.mjs); imported above and re-exported
// here for back-compat with anything importing it from this module.
export { normDate };
