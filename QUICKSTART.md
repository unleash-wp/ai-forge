# Quick Start — UnleashWP AI Forge

Forge is UnleashWP's AI tool + **plugin platform** for WordPress. It ships with one plugin today — the **Changelog Generator** — so this guide installs Forge and uses that first plugin. No account, token or cookie required to start.

Below: from nothing to a WordPress release changelog in about a minute.

## 1. Install

```bash
npm install -g @unleashwp/forge
```

Puts `ai-forge` on your PATH (`uwp` and `forge` are aliases). Plain Node ≥ 18, zero runtime dependencies; the browser UI ships pre-built.

No install? Use `npx`:

```bash
npx @unleashwp/forge@latest changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

## 2. Generate a changelog

```bash
ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

Prints a ready-to-edit **release-post template**: headline, count line, the two canonical source links, a highlights placeholder, and the grouped Core + Gutenberg changelog.

- Drop `--post` → full technical report.
- Add `--json` → structured data.
- `ai-forge -h` → every command.

## 3. Pick your surface

| You want… | Do this |
| --- | --- |
| **A UI** | `ai-forge serve` → `http://localhost:4321` (date picker + Copy buttons) |
| **Ask Claude Code / Codex** | `claude mcp add forge -- npx -y @unleashwp/forge@latest mcp`, then ask: *"WordPress 7.1 changelog for July 15–22, as a post."* |
| **A window in Claude Desktop** | `npm run mcpb:pack`, then install `unleashwp-ai-forge.mcpb` from Settings → Extensions |

## Optional: connect for more

Both optional — Forge runs without them.

- **GitHub token** → raises the API limit from 60 to 5,000/h (no scopes needed). `gh auth login`, or paste one in **Settings → Connectors**.
- **wordpress.org cookie** → turns on `--deep` (full Trac ticket text). Import it in the Setup UI, or `ai-forge cookie-import <chrome|safari|firefox|edge>`.

## More

Full docs are in the [**Wiki**](https://github.com/unleash-wp/ai-forge/wiki): Installation, Connectors, Using Forge from Claude & Codex, the Changelog tool, and building your own tool.
