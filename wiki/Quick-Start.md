# Quick Start

AI Forge is UnleashWP's AI tool + **plugin platform** for WordPress; it ships with one plugin today, the **Changelog Generator**. This guide installs AI Forge and uses that first plugin — from nothing to a WordPress release changelog in about a minute.

## 1. Install

```bash
npm install -g @unleashwp/ai-forge
```

This puts the `uwp-ai-forge` command on your PATH (`uwp` and `forge` are aliases). The CLI is plain Node ≥ 18 with zero runtime dependencies; the browser UI ships pre-built.

## 2. Generate a changelog

```bash
uwp-ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

That prints a ready-to-edit **release-post template**: a headline, a count line, the two canonical source links, a highlights placeholder, and the grouped changelog as raw material.

- Drop `--post` for the full technical report.
- Add `--json` for structured data.
- Run `uwp-ai-forge -h` for every command.

That's it — no account, no token, no cookie required. AI Forge reads everything it needs from public GitHub data. A GitHub token and a wordpress.org cookie are **optional** and only unlock higher rate limits and deep mode — see **[Connectors](Connectors)**.

## Prefer clicking?

```bash
uwp-ai-forge serve
```

Opens a browser UI at `http://localhost:4321` with a date-range picker and Copy buttons.

## Prefer asking an AI?

Register AI Forge once as an MCP server, then just ask Claude Code or Codex:

```bash
claude mcp add uwp-ai-forge -- npx -y @unleashwp/ai-forge@latest mcp
```

> "Give me the WordPress 7.1 release changelog for July 15–22, as a post."

The agent calls AI Forge's tools and drafts the post grounded in the real PRs and tickets. See **[Using AI Forge from Claude & Codex](Using-AI Forge-from-Claude-and-Codex)**.

## Next steps

- **[Connectors](Connectors)** — raise the GitHub limit to 5,000/h and turn on deep mode.
- **[The Changelog Plugin](The-Changelog-Tool)** — all the flags and how the counts are derived.
- **[Installation](Installation)** — the Claude Desktop one-click bundle and the dev setup.
