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

### 3. Core component grouping - automatic via the dev-notes tracker

When you pass `--milestone`, the CLI already groups Core by Trac component using
the WordPress docs-team **dev-notes tracker**
(`WordPress/Documentation-Issue-Tracker/<x-y>-dev-notes`). This is cookie-free
GitHub JSON, human-reviewed, tagged with `component` **and** `classification`
(`dev-note` / `misc-dev-note` / `field-guide`). The CLI joins it on ticket
number so the window stays exact. Nothing to run - it's in the output. Disable
with `--no-dev-notes`.

Changesets whose ticket is not in the tracker - newer than its snapshot,
excluded components (Build/Test Tools, tests), or version bumps with no ticket -
land under **Uncategorized**. That is expected, not an error.

#### Fallback: the `wporg-context` MCP (only when no tracker exists)

Early in a cycle the docs team hasn't triaged yet, so there is no tracker - the
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
names - if neither source is available, ship the flat Core list.

### 3b. Read the tickets in full (grounding - do this before writing)

The CLI gives ticket **numbers, summaries and metadata** cookie-free, but not the
ticket **description or discussion**. To ground the prose in what each ticket
actually says:

1. **Descriptions (deterministic, preferred):** re-run with `--deep --json`. One
   cookie-gated request pulls every milestone ticket's description into
   `core.ticketDetails`, and upgrades Uncategorized changesets to their real Trac
   component. Needs `WPORG_TRAC_COOKIE` (env) or `--trac-cookie <file>`.
   ```bash
   WPORG_TRAC_COOKIE='…' node bin/wp-release-helper.mjs --since <s> --until <e> --milestone <x.y> --deep --json
   ```
2. **Comments / live detail (optional):** for a specific ticket's discussion, use
   the `wporg-context` MCP `get-ticket {id}` (run `validate-auth` first).
3. **Gutenberg:** PR title + `[Type]`/`[Feature]` label is usually enough; open a
   PR (`gh pr view <n> -R WordPress/gutenberg`) only for the ones you feature.

No cookie → descriptions can't be read (Trac blocks cookieless scripts); say so
and ground the prose in the CLI summaries + the full Core changeset commit
messages (still substantial), and leave Uncategorized as-is.

### 4. Write the release post

Release coordinators publish a "What's in WordPress <x.y> Beta/RC N?" post.
Match that shape (see `references/example-post.md`):

1. **Headline** - `What's in WordPress <x.y> <Beta/RC N>?`
2. **Count line + sources** - e.g. "For technical details on the N issues
   addressed since <previous build>, see:" then the two links from the CLI's
   **Sources** block (Trac query + Gutenberg commits for the window). The count
   is the CLI's `coreTickets` + `gutenbergPRs`, or the Trac/GH totals - never
   estimated.
3. **Prose highlights** - 1-3 short paragraphs on the notable changes, grouped
   loosely (styling, media, editor, developer). Each sentence must trace to a
   real PR/ticket title from the CLI output; link the PR/ticket inline. Prefer
   the Gutenberg `[Feature]`-labelled PRs and the Core `dev-note` /
   `field-guide` tickets - those are what the docs team flagged as noteworthy.
4. **Notes** - deferrals ("X will not be included…"), security builds, or
   cross-release context, only if present in the data or given by the user.
5. **Contributors** - the union list.

**Grounding rules (hard):**
- Never write a highlight that is not backed by a PR/ticket title in the CLI
  output. No invented features, no guessed impact.
- Counts and links come straight from the tool - never estimate or round beyond
  what the CLI reports (a "more than N" phrasing is fine if N is the real count).
- If you are unsure what a change does, quote the PR/ticket title rather than
  paraphrasing speculatively.
- The `dev-note` / `field-guide` classification tells you what deserves a
  sentence; `exclude`-class and version-bump changes usually do not.

## Notes

- PR/ticket numbers, changeset `rXXXXX`, and props are parsed from commit
  messages; a version-bump commit legitimately has no ticket.
- Gutenberg contributors = commit author logins; Core contributors = the
  `Props` line (SVN commits are authored by the committer).
