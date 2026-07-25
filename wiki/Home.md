# UnleashWP AI Forge

**Turn a date window into a release-post changelog for WordPress Core + Gutenberg** — in your terminal, in Claude Code / Codex, or as a window inside Claude Desktop.

Forge is a small, self-hosted **toolbelt for WordPress release and dev work**, by [UnleashWP](https://unleash-wp.com). The free core ships with the **Changelog Generator**: give it a start date, an end date and a milestone, and it counts and lists everything that landed in Core and Gutenberg — ready to drop into a release post.

It is also a **plugin platform**: every tool is a folder under `tools/`, so the community can add more without touching the shell. The CLI has **zero runtime dependencies** (plain Node ≥ 18).

---

## Start here

- **[Quick Start](Quick-Start)** — from nothing to a changelog in two commands.
- **[Installation](Installation)** — npm, development clone, Claude Desktop bundle.
- **[Connectors](Connectors)** — the optional GitHub token + wordpress.org cookie, and what "deep mode" adds.
- **[Using Forge from Claude & Codex](Using-Forge-from-Claude-and-Codex)** — register it once as an MCP server, then ask in plain language.
- **[The Changelog Tool](The-Changelog-Tool)** — flags, output modes, where the numbers come from.
- **[Building a Tool](Building-a-Tool)** — add your own tool as a plugin.
- **[FAQ](FAQ)** — accounts, storage, privacy, updates.

---

## What it looks like

Three surfaces, one tool:

| Surface | How you use it | Needs |
| --- | --- | --- |
| **Terminal** | `ai-forge changelog --since … --until … --milestone …` | `npm i -g @unleashwp/forge` |
| **Claude Code / Codex** | register the MCP server, then ask in plain language | `npx @unleashwp/forge@latest mcp` |
| **Claude Desktop** | one-click `.mcpb` bundle, opens a window — no browser | build with `npm run mcpb:pack` |
| **Browser UI** | `ai-forge serve` → a date-range picker at `http://localhost:4321` | ships pre-built in the package |

## Ground rule

Forge never invents features and never estimates counts. Every number and link it prints traces to a real pull request, Trac ticket or changeset. When you (or an agent) write the prose around it, keep it that way: each highlight should point at something the tool actually found.

## Not affiliated

An independent project by Benjamin Zekavica (Morvance). Not linked to the WordPress Foundation or Automattic Inc.
