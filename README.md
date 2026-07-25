# UnleashWP AI Forge

A small, self-hosted **toolbelt for WordPress release and dev work**, by
[UnleashWP](https://unleash-wp.com). The free core ships with the **Changelog
Generator**: give it a date window and it counts and lists everything that landed
in Core and Gutenberg - ready to drop into a release post.

Forge is a **plugin platform**. Every tool is a folder under `tools/`, so the
community can add more without touching the shell - see
[CONTRIBUTING.md](CONTRIBUTING.md). It runs as a plain Node server with a React
UI; the CLI keeps **zero runtime dependencies**.

The Changelog Generator reads from:

- **Gutenberg** → `github.com/WordPress/gutenberg` (branch `wp/<milestone>`)
- **Core** → `github.com/WordPress/wordpress-develop` (git mirror of Core SVN)
- **Core component + dev-note classification** → the docs-team dev-notes tracker
  ([`WordPress/Documentation-Issue-Tracker`](https://github.com/WordPress/Documentation-Issue-Tracker)),
  cookie-free GitHub JSON. Fallback when no tracker exists yet: the
  [Automattic `mcp-context-wporg`](https://github.com/Automattic/mcp-context-wporg)
  MCP (Trac is bot-walled for plain scripts).

Everything the CLI needs is on GitHub - **no Trac cookie, deterministic, runs in
CI/Codex.**

## Quick start for release coordinators

**In a terminal** (the `ai-forge` command, with `uwp` as a short alias):

```bash
npm install -g @unleashwp/forge
ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

That prints a ready-to-edit release-post template. Run `ai-forge serve` for a
click-driven browser UI, or `ai-forge -h` for every command.

**From Claude Code or Codex** - register Forge once as an MCP server, then ask in
plain language:

```bash
claude mcp add forge -- npx -y @unleashwp/forge@latest mcp
```

> "Give me the WordPress 7.1 release changelog for July 15–22, as a post."

The agent calls Forge's tools (`get_changelog`, `list_milestones`, …) and drafts
the post grounded in the real PRs and tickets.

**In Claude Desktop** - install the one-click bundle: run `npm run mcpb:pack` to
build `unleashwp-ai-forge.mcpb`, then open it from Settings → Extensions. It
prompts for an optional GitHub token + wordpress.org cookie and needs no local
Node.

## Why these sources

| Surface | Where changes live | This tool reads |
| --- | --- | --- |
| Gutenberg | GitHub PRs on `wp/<milestone>` | commits + `[Type]` labels |
| Core | Trac tickets, committed to SVN | the `wordpress-develop` git mirror |
| Core grouping | Trac ticket metadata | the dev-notes tracker JSON (join on ticket #) |

Core commit messages carry everything a release post needs - `Fixes #NNNNN`
(closed Trac ticket), `Props alice, bob` (contributors), and
`git-svn-id: …@62815` (changeset `r62815`) - so the mirror gives reliable
counts and links without touching Trac. For component grouping the CLI joins
each windowed ticket against the dev-notes tracker (which is already tagged with
component + `dev-note`/`misc-dev-note`/`field-guide`). Tickets not in the
tracker - newer than its snapshot, excluded components, or version bumps - land
under **Uncategorized**.

## Install

```bash
npm install -g @unleashwp/forge   # the `ai-forge` command (alias: `uwp`)
gh auth login                     # optional: raises the GitHub API limit to 5000/h
```

`ai-forge` is now on your PATH — no `node …` needed. The core CLI is
dependency-free (plain Node ≥18, uses the global `fetch`); the browser UI
(`ai-forge serve`) is a webpack/React bundle that ships pre-built in the package.

**For development**, clone the repo instead and build the UI once:

```bash
git clone https://github.com/unleash-wp/wp-release-helper
cd wp-release-helper && npm install   # builds dist/ via the prepare script
node bin/wp-release-helper.mjs -h
```

## Usage

```bash
ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1
```

### Browser UI

Prefer clicking a date range over typing flags. The browser UI is a webpack
build (React + Chakra UI bundled into `dist/`), so it needs a one-time `npm install`
(which builds it via the `prepare` script; or run `npm run build`). The CLI
report path above needs neither.

```bash
npm install          # builds the UI bundle (dist/)
uwp serve            # -> http://localhost:4321
```

### Claude Code & Codex (MCP)

`uwp mcp` runs Forge as an MCP server over stdio, so an AI coding agent pulls
release data live and keeps working with it. It exposes `get_changelog`,
`list_milestones` and `list_branches` tools, plus **skills** (MCP prompts) like
`write_release_post` that teach the agent to use them — run `uwp skills` to list
them. Any plugin can add more.

Both agents run Forge via `npx @unleashwp/forge@latest`, so it stays
dependency-free and **one `npm publish` updates Claude Code and Codex together**
— no reinstall.

**Claude Code — as a plugin (recommended):**

```
/plugin marketplace add unleash-wp/wp-release-helper
/plugin install forge@unleashwp-forge
```

The plugin auto-registers the `forge` MCP server; check with `/mcp`. Or add just
the server directly:

```bash
claude mcp add forge -- npx -y @unleashwp/forge@latest mcp
```

**Codex:**

```bash
codex mcp add forge -- npx -y @unleashwp/forge@latest mcp
```

### Releasing (keeps both agents in sync)

Forge ships from npm; both agents resolve `@latest` at launch, so publishing is
the single update step.

```bash
npm version patch          # bump + tag
npm publish                # @unleashwp/forge (public); prepublish builds + tests
git push --follow-tags     # updates the Claude Code plugin (marketplace) too
```

`gh release create` from the same tag keeps the in-app "update available" check
(which reads GitHub Releases) aligned with the published version.

Pick the **since/until** dates, milestone and branches, hit **Generate**, and
get: a big count of issues addressed, the summary stat cards, a **Sources** block
with the exact Trac-query and Gutenberg-commits links (the parameter links to drop
into the post so anyone can verify), and the changelog under two tabs -
**Changelog** (Gutenberg + Core, every commit linked) and **Props** (the merged
contributor list) - plus **Copy post** / **Copy Markdown** / **Download** buttons.
The server binds to `127.0.0.1`, so nothing sensitive touches the browser.

**Setup.** The **Setup** panel wires up two keys - each is your own (nothing is
shared), stored locally in owner-only files (mode `600`) and sent only to GitHub
/ WordPress.org. Both have a **Disconnect** button.

- **GitHub** - raises your API limit from 60 to 5000 req/h. Works with **any**
  GitHub account: you never need access to the WordPress org and the token needs
  **no scopes** (it only reads public repos). One click if the `gh` CLI is logged
  in (auto-detected); otherwise create a token (leave every scope unchecked) and
  paste it once - it auto-saves and tests on paste. Saved to
  `~/.config/wp-trac/github-token`. Skip it entirely and the tool still runs at
  60 req/h.
- **WordPress.org** - only for **deep** (full ticket descriptions). Quickest is
  the one-click **import from your browser** (Chrome / Safari / Firefox / Edge,
  macOS) - the local server reads `wporg_logged_in` + `wporg_sec` straight from
  the browser's cookie store (Chrome/Edge prompt the Keychain to decrypt). Same
  thing on the CLI: `uwp cookie-import <browser>`. Or paste the cookie manually.
  A web page can't read it for you (it's HttpOnly), which is why the import runs
  locally. Saved to `~/.config/wp-trac/cookie`.

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
  most Beta posts, zero setup - this is what makes onboarding instant.
- **`--deep` (one-time cookie):** adds the actual ticket **descriptions** for the
  whole milestone in a single request, and gives every changeset its real Trac
  component (no more Uncategorized). The description text lands in `--json`
  (`core.ticketDetails`) for grounding the post. Trac blocks cookieless scripts,
  so this needs your WordPress.org session cookie once - there is no cookie-free
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
- … ([#80576](…)) - Mamaduka
## Core (`trunk`)
- [r62830](…): XML-RPC: … - [#65682](…) - props josephscott, SergeyBiryukov
## Contributors (105)
…
```

## Use inside Claude Code / Codex

A Claude Code skill ships in [`.claude/skills/wp-release-helper`](.claude/skills/wp-release-helper/SKILL.md).
Run Claude Code from this repo and ask, e.g.:

> Summarize what landed in 7.1 between July 15 and July 22 for the release post.

The skill runs the CLI, then (if the `wporg-context` MCP is connected) enriches
the Core section with Trac component grouping and assembles a release post
scaffold - without inventing any counts or highlights.

### Connect the Trac MCP (`wporg-context`) - optional fallback

Only needed when a release has **no dev-notes tracker yet** (early in the
cycle), or for live ticket detail / bbPress / BuddyPress. Otherwise the CLI
groups Core from the tracker with no setup. The [Automattic
`mcp-context-wporg`](https://github.com/Automattic/mcp-context-wporg) server is
not on npm - clone + build:

```bash
git clone https://github.com/Automattic/mcp-context-wporg ~/Documents/mcp-context-wporg
cd ~/Documents/mcp-context-wporg && npm install && npm run build
claude mcp add -s user -e WPORG_TRAC_COOKIE='<your wp.org cookie>' \
  wporg-context -- node ~/Documents/mcp-context-wporg/dist/index.js
```

`WPORG_TRAC_COOKIE` is your WordPress.org session cookie (Trac 403s bot traffic
without it) - Automattic recommends a dedicated service account. MCP servers load
at session start, so restart Claude Code after adding it; test with the server's
`validate-auth` tool.

## License

GPL-2.0-or-later
