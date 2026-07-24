# wp-release-helper

Fast change summaries for **WordPress release coordinators**. Give it a date
window and it counts and lists everything that landed in Core and Gutenberg —
ready to drop into a release post.

- **Gutenberg** → `github.com/WordPress/gutenberg` (branch `wp/<milestone>`)
- **Core** → `github.com/WordPress/wordpress-develop` (git mirror of Core SVN)
- **Trac** ticket component/milestone grouping → added by the bundled Claude
  Code skill via the [Automattic `mcp-context-wporg`](https://github.com/Automattic/mcp-context-wporg)
  MCP server (Trac itself is bot-walled for plain scripts).

## Why the two sources

| Surface | Where changes live | This tool reads |
| --- | --- | --- |
| Gutenberg | GitHub PRs on `wp/<milestone>` | commits + `[Type]` labels |
| Core | Trac tickets, committed to SVN | the `wordpress-develop` git mirror |

Core commit messages carry everything a release post needs — `Fixes #NNNNN`
(closed Trac ticket), `Props alice, bob` (contributors), and
`git-svn-id: …@62815` (changeset `r62815`) — so the mirror gives reliable
counts and links without touching Trac. Component grouping is the one thing that
needs Trac, and the skill adds it via MCP when available.

## Install

```bash
git clone https://github.com/unleash-wp/wp-release-helper
cd wp-release-helper
gh auth login   # optional but recommended: raises GitHub API limit to 5000/h
```

No dependencies — plain Node ≥18 (uses the global `fetch`).

## Usage

```bash
node bin/wp-release-helper.mjs --since 2026-07-15 --until 2026-07-22 --milestone 7.1
```

| Option | Meaning |
| --- | --- |
| `--since <date>` | Window start (`YYYY-MM-DD` or ISO 8601). Required. |
| `--until <date>` | Window end. Required. |
| `--milestone <x.y>` | Milestone; defaults Gutenberg branch to `wp/<x.y>`. |
| `--gb-branch <ref>` | Override the Gutenberg branch. |
| `--core-branch <ref>` | Override the `wordpress-develop` branch (default `trunk`). |
| `--no-labels` | Skip Gutenberg label grouping (fewer API calls). |
| `--json` | Emit raw JSON instead of Markdown. |

### Output (Markdown, abridged)

```
# WordPress 7.1 release changes
**Window:** 2026-07-15T00:00:00Z → 2026-07-22T23:59:59Z

## Summary
| Metric | Count |
| Gutenberg commits (`wp/7.1`) | 74 |
| Gutenberg merged PRs | 74 |
| Core changesets (`trunk`) | 70 |
| Core tickets closed | 37 |
| Contributors (union) | 105 |

## Gutenberg (`wp/7.1`)
### Bug (51)
- … ([#80576](…)) — Mamaduka
## Core (`trunk`)
- [r62830](…): XML-RPC: … — [#65682](…) — props josephscott, SergeyBiryukov
## Contributors (105)
…
```

## Use inside Claude Code / Codex

A Claude Code skill ships in [`.claude/skills/wp-release-helper`](.claude/skills/wp-release-helper/SKILL.md).
Run Claude Code from this repo and ask, e.g.:

> Summarize what landed in 7.1 between July 15 and July 22 for the release post.

The skill runs the CLI, then (if the `wporg-context` MCP is connected) enriches
the Core section with Trac component grouping and assembles a release post
scaffold — without inventing any counts or highlights.

### Connect the Trac MCP (`wporg-context`)

Core component grouping comes from the [Automattic
`mcp-context-wporg`](https://github.com/Automattic/mcp-context-wporg) server
(not on npm — clone + build):

```bash
git clone https://github.com/Automattic/mcp-context-wporg ~/Documents/mcp-context-wporg
cd ~/Documents/mcp-context-wporg && npm install && npm run build
claude mcp add -s user -e WPORG_TRAC_COOKIE='<your wp.org cookie>' \
  wporg-context -- node ~/Documents/mcp-context-wporg/dist/index.js
```

`WPORG_TRAC_COOKIE` is your WordPress.org session cookie (Trac 403s bot traffic
without it) — Automattic recommends a dedicated service account. MCP servers load
at session start, so restart Claude Code after adding it; test with the server's
`validate-auth` tool.

## License

GPL-2.0-or-later
