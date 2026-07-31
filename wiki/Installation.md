# Installation

AI Forge runs in four places. Pick whichever fits how you work. They share the same core.

## npm (terminal)

```bash
npm install -g @unleashwp/ai-forge   # the `uwp-ai-forge` command (aliases: uwp, forge)
gh auth login                     # optional: raises the GitHub API limit to 5000/h
```

`uwp-ai-forge` is now on your PATH. The core CLI is dependency-free (plain Node ≥ 18, uses the global `fetch`); the browser UI (`uwp-ai-forge serve`) is a webpack/React bundle that ships **pre-built** in the package, so there is nothing to compile.

Run it without a global install using `npx`:

```bash
npx @unleashwp/ai-forge@latest changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

## Claude Code / Codex (MCP server)

Register AI Forge once; the agent then calls its tools live.

```bash
# Claude Code
claude mcp add uwp-ai-forge -- npx -y @unleashwp/ai-forge@latest mcp

# Codex: add an MCP server:
#   command = "npx", args = ["-y", "@unleashwp/ai-forge@latest", "mcp"]
```

The MCP server is named **`forge`**. See **[Using AI Forge from Claude & Codex](Using-AI Forge-from-Claude-and-Codex)**.

## Claude Desktop (one-click bundle)

AI Forge ships as an **MCPB** bundle: a single `.mcpb` file you install from Claude Desktop's Extensions screen. Claude Desktop bundles its own Node, so there is no local Node requirement.

```bash
git clone https://github.com/unleash-wp/ai-forge
cd uwp-ai-forge
npm install
npm run mcpb:pack        # builds dist/ and packs unleashwp-ai-forge.mcpb
```

Then open **Claude Desktop → Settings → Extensions** and install `unleashwp-ai-forge.mcpb`. On install it prompts for an optional GitHub token and wordpress.org cookie (both stored by Claude Desktop, both optional).

## Claude Code plugin (marketplace)

The repo ships a Claude Code plugin manifest, so you can add AI Forge through the plugin marketplace flow. The plugin registers the same `forge` MCP server via `npx @unleashwp/ai-forge@latest mcp`.

## Development (clone + build)

```bash
git clone https://github.com/unleash-wp/ai-forge
cd uwp-ai-forge
npm install                 # installs build deps + builds the UI bundle (dist/)
node bin/ai-forge.mjs -h
```

- `npm run build`: rebuild the browser bundle after any client change.
- `npm run watch`: rebuild on save.
- `npm test`: the Node test suite.

The core CLI (`bin/` + `src/*.mjs`) has **zero runtime dependencies**. React, webpack and Babel are build-time devDependencies that only produce the browser bundle. They never load in the CLI.

## Requirements

- **Node ≥ 18** (for the global `fetch`).
- **git** on your PATH (used for `git ls-remote`, which lists branches without hitting the GitHub API rate limit).
