# Quick Start — UnleashWP AI Forge

AI Forge is UnleashWP's AI tool + **plugin platform** for WordPress. It ships with one plugin today — the **Changelog Generator** — so this guide installs AI Forge and uses that first plugin. No account or password needed — but connecting your WordPress.org login is **required**, or the counts come back inaccurate.

Below: from nothing to a WordPress release changelog in about a minute.

## 1. Install

```bash
npm install -g @unleashwp/ai-forge
```

Puts `uwp-ai-forge` on your PATH (`uwp` and `forge` are aliases). Plain Node ≥ 18, zero runtime dependencies; the browser UI ships pre-built.

No install? Use `npx`:

```bash
npx @unleashwp/ai-forge@latest changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

## 2. Connect WordPress.org (required)

AI Forge counts changes and contributors from WordPress.org Trac, which blocks
logged-out scripts — so a session cookie is required or the counts are inaccurate.
Import it from a browser you're already signed in to:

```bash
uwp-ai-forge cookie-import <chrome|safari|firefox|edge>
```

Or connect it in the app's **Setup → Connectors**. It stays on your computer.
Until connected, the tools refuse rather than return wrong numbers.

## 3. Generate a changelog

```bash
uwp-ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

Prints a ready-to-edit **release-post template**: headline, count line, the two canonical source links, a highlights placeholder, and the grouped Core + Gutenberg changelog.

- Drop `--post` → full technical report.
- Add `--json` → structured data.
- `uwp-ai-forge -h` → every command.

## 4. Pick your surface

| You want… | Do this |
| --- | --- |
| **A UI** | `uwp-ai-forge serve` → `http://localhost:4321` (date picker + Copy buttons) |
| **Ask Claude Code / Codex** | `claude mcp add uwp-ai-forge -- npx -y @unleashwp/ai-forge@latest mcp`, then ask: *"WordPress 7.1 changelog for July 15–22, as a post."* |
| **A window in Claude Desktop** | `npm run mcpb:pack`, then install `unleashwp-ai-forge.mcpb` from Settings → Extensions |

## Optional: GitHub token

- **GitHub token** → raises the API limit from 60 to 5,000/h (no scopes needed). `gh auth login`, or paste one in **Settings → Connectors**. This one is optional; the WordPress.org connection in step 2 is the required credential.

## More

Full docs are in the [**Wiki**](https://github.com/unleash-wp/ai-forge/wiki): Installation, Connectors, Using AI Forge from Claude & Codex, the Changelog plugin, and building your own plugin.
