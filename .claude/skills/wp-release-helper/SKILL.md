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
label, a flat Core changeset list (with `rXXXXX` + Trac ticket links + props),
and a merged contributor list.

### 3. Group Core by Trac component via the `mcp-context-wporg` MCP

The CLI cannot group Core by component — Trac is bot-walled for scripts. Use the
**Automattic `mcp-context-wporg`** MCP server for the component metadata. Its
tools are reached through two meta-tools:

- `wporg-load-provider` with `{ "provider": "trac" }`
- `wporg-execute-tool` with `{ "provider": "trac", "tool": "<name>", "args": {…} }`

Trac tools available: `search-tickets`, `get-ticket {id}`, `list-components`,
`get-timeline {days}`, `get-report {id}`, `validate-auth`.

**Important — no changetime filter.** `search-tickets` filters by `milestone`,
`component`, `status`, `type`, `priority`, `owner` — but not by a date range.
So do NOT ask the MCP for "closed between X and Y". Instead **join on ticket
number**, which keeps the window exact and the component data from Trac:

1. Take the windowed, deterministic ticket set from the CLI JSON
   (`core.commits[].tickets` — parsed from `Fixes #NNNNN` in the changesets in
   the window).
2. `search-tickets` with `{ milestone: "<x.y>", status: "closed", limit: 200 }`
   to pull that milestone's closed tickets *with their `component`*. Page/raise
   `limit` if the milestone has more.
3. Join by ticket number: assign each windowed ticket its component from the
   search results. For any windowed ticket missing from the milestone results,
   call `get-ticket {id}` to fetch its component directly.
4. Group the windowed Core changesets under their tickets' components.

The server is registered as `wporg-context` (tools exposed as
`mcp__wporg-context__*`). Optionally run `validate-auth` first — Trac needs
`WPORG_TRAC_COOKIE` set on the MCP server (a WordPress.org session cookie), else
it 403s on the bot wall.

If the MCP is **not** connected, say so and ship the flat Core list from the
CLI; do not invent component names.

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
