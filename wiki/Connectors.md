# Connectors

Connectors are the credentials a tool uses to reach its data providers. Forge stores them **on your machine, in owner-only files** (`~/.config/wp-trac/`), and sends them only to the provider they belong to. They are never printed and never leave your device.

Both connectors below are **optional** — Forge runs without them. They only raise limits and unlock deep mode.

## GitHub

| | |
| --- | --- |
| **What it does** | Raises the GitHub API limit from **60 to 5,000 requests/hour**. |
| **Needed?** | Optional, but recommended for large windows or busy hours. |
| **Scopes** | **None.** Forge only reads public repositories. |

Three ways to connect, in order of convenience:

1. **`gh` CLI** — if you are logged in (`gh auth login`), Forge detects the token automatically.
2. **Setup UI** — in `ai-forge serve`, open **Settings → Connectors → GitHub** and paste a token (create one with every scope unchecked).
3. **Environment** — set `GITHUB_TOKEN` (this always wins and is read live).

## WordPress.org (deep mode)

| | |
| --- | --- |
| **What it does** | Enables **deep mode**: full Trac ticket text, so each change carries its real description and component. |
| **Needed?** | Only if you want ticket descriptions (the `--deep` flag). |
| **Value** | Your logged-in session cookie: `wporg_logged_in=…; wporg_sec=…`. |

Trac's CSV export is behind a bot wall for plain scripts, so deep mode needs a logged-in wordpress.org session cookie. Ways to provide it:

1. **Import from your browser** — in the Setup UI, "Import from &lt;browser&gt;" reads the cookie from a browser where you are logged in (macOS; approve the Keychain prompt). On the CLI: `ai-forge cookie-import <chrome|safari|firefox|edge>`.
2. **Paste manually** — log in at wordpress.org, then DevTools → Application → Cookies → copy `wporg_logged_in` + `wporg_sec` as `name=value; name=value`.
3. **Environment** — set `WPORG_TRAC_COOKIE` (always wins, read live).

Without the cookie, Forge still works — it grounds the changelog in ticket **summaries** and the full Core changeset commit messages instead of ticket descriptions.

## Claude Code & Codex

The Connectors screen also shows **command connectors** for Claude Code and Codex — the one-line command that registers Forge as an MCP server. These aren't credentials; they're a copy-paste convenience. See **[Using Forge from Claude & Codex](Using-Forge-from-Claude-and-Codex)**.

## Security

Forge's local server refuses **cross-site** state-changing requests: a web page you have open in a browser cannot POST a cookie or token to `localhost`. Reads return only public data. Your credentials stay in owner-only files and are sent only to GitHub / WordPress.org.
