# Building a Tool

AI Forge is a plugin platform. **Every tool is a folder under `tools/`** — add one and it appears in the rail, the CLI, and (if you export them) the MCP surface. Nothing in the shell needs changing.

The full guide lives in [CONTRIBUTING.md](https://github.com/unleash-wp/ai-forge/blob/main/CONTRIBUTING.md). This is the shape of it.

## Anatomy

```
tools/<id>/
  plugin.json    manifest (required)
  client.jsx     a default-exported React component (the UI)
  server.mjs     optional backend: routes, commands, MCP tools, skills, connectors
```

Scaffold from the template:

```bash
npm run new-tool -- <id> "Display Name"
npm run build      # or: npm run watch
```

`id` must match the folder name. Discovery is automatic — the client picks up `client.jsx` files and the server loads each `server.mjs`.

## What a `server.mjs` can export

| Export | Becomes |
| --- | --- |
| `routes` | HTTP endpoints, mounted under `/api/<your-id>/`. |
| `commands` | Terminal subcommands — `ai-forge <name> …`. |
| `mcpTools` | Tools served over `ai-forge mcp` (stdio) to Claude Code / Codex. |
| `skills` | Reusable AI prompts, served as MCP prompts and via `ai-forge skills`. |
| `uiResources` | MCP-App panels rendered in a sandboxed iframe inside the conversation. |
| `connectors` | Credential / command connectors that show up on the Setup screen. |

Import shared logic from `../../src/`. Credential/setup routes stay in the core shell because every tool shares them.

## Keep the core lean

The CLI has **zero runtime dependencies** — Node built-ins and the global `fetch` only. React / webpack / Babel are build-time devDependencies that produce the browser bundle and never load in the CLI. Keep new tools the same way, so `ai-forge` stays install-free and works in CI and Codex.

## Guidelines

- Match the existing style; use the shared UI primitives in `src/client/ui` so every tool looks and behaves the same.
- Accessibility and clear German/English strings are first-class — user-facing text is translatable.
- Keep `stdout` for JSON-RPC only in MCP tools; send logging to `stderr`.

See [CONTRIBUTING.md](https://github.com/unleash-wp/ai-forge/blob/main/CONTRIBUTING.md) for full examples of each export, the manifest fields, and the design tokens.
