# wp-release-helper

Fast change summaries for **WordPress release coordinators**. Give it a date
window and it counts and lists everything that landed in Core and Gutenberg —
ready to drop into a release post.

- **Gutenberg** → `github.com/WordPress/gutenberg` (branch `wp/<milestone>`)
- **Core** → `github.com/WordPress/wordpress-develop` (git mirror of Core SVN)
- **Core component + dev-note classification** → the docs-team dev-notes tracker
  ([`WordPress/Documentation-Issue-Tracker`](https://github.com/WordPress/Documentation-Issue-Tracker)),
  cookie-free GitHub JSON. Fallback when no tracker exists yet: the
  [Automattic `mcp-context-wporg`](https://github.com/Automattic/mcp-context-wporg)
  MCP (Trac is bot-walled for plain scripts).

Everything the CLI needs is on GitHub — **no Trac cookie, deterministic, runs in
CI/Codex.**

## Quick start for release coordinators

Clone the repo, then pick one path — no build, no dependencies.

**With Claude Code or Codex** — open the repo and just ask:

> "Give me the WordPress 7.1 release changelog for July 15–22, as a post."

The agent reads this repo's own instructions (`CLAUDE.md` / `AGENTS.md`), runs
the tool, and drafts the post grounded in the real PRs and tickets.

**In a terminal:**

```bash
git clone https://github.com/unleash-wp/wp-release-helper
cd wp-release-helper
node bin/wp-release-helper.mjs --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

That prints a ready-to-edit release-post template. Add `serve` instead for a
click-driven browser UI, or `npm link` once to get the short `uwp` command.

## Why these sources

| Surface | Where changes live | This tool reads |
| --- | --- | --- |
| Gutenberg | GitHub PRs on `wp/<milestone>` | commits + `[Type]` labels |
| Core | Trac tickets, committed to SVN | the `wordpress-develop` git mirror |
| Core grouping | Trac ticket metadata | the dev-notes tracker JSON (join on ticket #) |

Core commit messages carry everything a release post needs — `Fixes #NNNNN`
(closed Trac ticket), `Props alice, bob` (contributors), and
`git-svn-id: …@62815` (changeset `r62815`) — so the mirror gives reliable
counts and links without touching Trac. For component grouping the CLI joins
each windowed ticket against the dev-notes tracker (which is already tagged with
component + `dev-note`/`misc-dev-note`/`field-guide`). Tickets not in the
tracker — newer than its snapshot, excluded components, or version bumps — land
under **Uncategorized**.

## Install

```bash
git clone https://github.com/unleash-wp/wp-release-helper
cd wp-release-helper
npm link        # installs the `uwp` command globally
gh auth login   # optional but recommended: raises GitHub API limit to 5000/h
```

No dependencies — plain Node ≥18 (uses the global `fetch`). Without `npm link`
you can still run it as `node bin/wp-release-helper.mjs …`.

## Usage

```bash
uwp --since 2026-07-15 --until 2026-07-22 --milestone 7.1
```

### Browser UI

Prefer clicking a date range over typing flags:

```bash
uwp serve            # -> http://localhost:4321
```

Pick the **since/until** dates, milestone and branches, hit **Generate**, and
get: a big count of issues addressed, the summary stat cards, a **Sources** block
with the exact Trac-query and Gutenberg-commits links (the parameter links to drop
into the post so anyone can verify), and the changelog under two tabs —
**Changelog** (Gutenberg + Core, every commit linked) and **Props** (the merged
contributor list) — plus **Copy post** / **Copy Markdown** / **Download** buttons.
The server binds to `127.0.0.1`, so nothing sensitive touches the browser.

**Setup.** There is nothing to set up for GitHub. It reads only public repos, so
any account works — you never need access to the WordPress org and no token
scopes. If the `gh` CLI is logged in it is auto-detected (60 → 5000 req/h);
otherwise the tool just runs at 60 req/h. The header's GitHub badge shows which
tier you're on.

The one optional key is the **WordPress.org** cookie, and only for **deep** (full
ticket descriptions). Open the **Setup** panel and paste your `wporg_logged_in` +
`wporg_sec` cookie once; it auto-saves and tests the moment you paste, and a
**Disconnect** button removes it again. Saved to `~/.config/wp-trac/cookie`
(owner-only, mode `600`), sent only to WordPress.org. A web page can't read that
cookie for you (it's HttpOnly), so the one paste is the simplest safe path.

| Option | Meaning |
| --- | --- |
| `--since <date>` | Window start (`YYYY-MM-DD` or ISO 8601). Required. |
| `--until <date>` | Window end. Required. |
| `--milestone <x.y>` | Milestone; defaults Gutenberg branch to `wp/<x.y>`. |
| `--gb-branch <ref>` | Override the Gutenberg branch. |
| `--core-branch <ref>` | Override the `wordpress-develop` branch (default `trunk`). |
| `--no-labels` | Skip Gutenberg label grouping (fewer API calls). |
| `--post` | Emit a fill-in release-post template. |
| `--deep` | Read full Trac ticket **descriptions** (one cookie-gated CSV request); fills Uncategorized + adds descriptions to `--json`. |
| `--trac-cookie <file>` | File with the `WPORG_TRAC_COOKIE` value for `--deep` (or set the env var). |
| `--json` | Emit raw JSON instead of Markdown. |

### Reading depth

- **Default (cookie-free):** ticket numbers, summaries, component, type, owner,
  classification, full Core changeset messages, dev-note grouping. Enough for
  most Beta posts, zero setup — this is what makes onboarding instant.
- **`--deep` (one-time cookie):** adds the actual ticket **descriptions** for the
  whole milestone in a single request, and gives every changeset its real Trac
  component (no more Uncategorized). The description text lands in `--json`
  (`core.ticketDetails`) for grounding the post. Trac blocks cookieless scripts,
  so this needs your WordPress.org session cookie once — there is no cookie-free
  way to read ticket bodies. Ticket *comments* are out of scope for the batch;
  read those per-ticket via the `wporg-context` MCP if needed.

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

### Connect the Trac MCP (`wporg-context`) — optional fallback

Only needed when a release has **no dev-notes tracker yet** (early in the
cycle), or for live ticket detail / bbPress / BuddyPress. Otherwise the CLI
groups Core from the tracker with no setup. The [Automattic
`mcp-context-wporg`](https://github.com/Automattic/mcp-context-wporg) server is
not on npm — clone + build:

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
