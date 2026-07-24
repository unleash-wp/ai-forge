---
name: wp-release-helper
description: >
  Generate a WordPress/Gutenberg release-post change summary for a date window.
  Use when a release coordinator asks to "summarize changes since X", "what
  landed in <milestone>", "build the release notes / release post", or gives a
  date range for Core + Gutenberg. Counts commits/PRs/changesets/tickets,
  groups Gutenberg by label and Core by Trac component, lists contributors.
---

# wp-release-helper

Turn a date window into a release-post-ready change summary across the two
WordPress source-of-truth surfaces:

- **Gutenberg** → `github.com/WordPress/gutenberg` (branch `wp/<milestone>`)
- **Core** → `github.com/WordPress/wordpress-develop` (git mirror of Core SVN)

## Steps

### 1. Get the window + milestone

Ask for / confirm: start date, end date, milestone (e.g. `7.1`). Dates are
`YYYY-MM-DD`. Default Gutenberg branch is `wp/<milestone>`; Core branch is
`trunk` (override with `--core-branch 6.9` etc. once a release branch exists).

### 2. Run the CLI (does all counting deterministically)

```bash
node bin/wp-release-helper.mjs --since <start> --until <end> --milestone <x.y>
```

Add `--json` when you want to post-process, `--no-labels` to skip the Gutenberg
label lookup (faster, fewer API calls). Needs `gh auth login` (5000 req/h);
falls back to anonymous 60/h with a warning.

The CLI outputs: summary counts table, Gutenberg grouped by `[Type]`/`[Feature]`
label, Core grouped by Trac component + dev-note classification (via the
dev-notes tracker, step 3), and a merged contributor list.

### 3. Core component grouping — automatic via the dev-notes tracker

When you pass `--milestone`, the CLI already groups Core by Trac component using
the WordPress docs-team **dev-notes tracker**
(`WordPress/Documentation-Issue-Tracker/<x-y>-dev-notes`). This is cookie-free
GitHub JSON, human-reviewed, tagged with `component` **and** `classification`
(`dev-note` / `misc-dev-note` / `field-guide`). The CLI joins it on ticket
number so the window stays exact. Nothing to run — it's in the output. Disable
with `--no-dev-notes`.

Changesets whose ticket is not in the tracker — newer than its snapshot,
excluded components (Build/Test Tools, tests), or version bumps with no ticket —
land under **Uncategorized**. That is expected, not an error.

#### Fallback: the `wporg-context` MCP (only when no tracker exists)

Early in a cycle the docs team hasn't triaged yet, so there is no tracker — the
CLI prints a notice and leaves Core flat. Then use the Automattic
`mcp-context-wporg` MCP (registered here as `wporg-context`, tools
`mcp__wporg-context__*`) for component data:

- meta-tools `wporg-load-provider {provider:"trac"}` then
  `wporg-execute-tool {provider:"trac", tool:"…", args:{…}}`.
- `search-tickets` has **no changetime filter** → join on ticket number:
  `search-tickets {milestone, status:"closed", limit:200}` for component-per-
  ticket, `get-ticket {id}` for any miss. Group the windowed changesets by it.
- Needs `WPORG_TRAC_COOKIE` on the server; run `validate-auth` to check.

Also handy for live ticket detail and bbPress/BuddyPress. Never invent component
names — if neither source is available, ship the flat Core list.

### 4. Assemble the release post scaffold

Produce, in this order:
1. One-line headline with the milestone + window.
2. Counts table (verbatim from the CLI).
3. Gutenberg highlights grouped by label — keep PR links + author handles.
4. Core changes grouped by component (from step 3) or flat (fallback).
5. Contributor thanks (the union list).

**Do not** write prose "highlights" that aren't backed by a PR/ticket title.
Only summarize what the commit/PR/ticket titles actually say. Counts and links
come straight from the tool — never estimate them.

## Notes

- PR/ticket numbers, changeset `rXXXXX`, and props are parsed from commit
  messages; a version-bump commit legitimately has no ticket.
- Gutenberg contributors = commit author logins; Core contributors = the
  `Props` line (SVN commits are authored by the committer).
