# UnleashWP AI Forge — instructions for coding agents (Codex & others)

AI Forge is a **plugin platform for WordPress tooling** that bridges to your AI
over MCP. **Zero runtime dependencies, plain Node ≥18.** Every capability is a
plugin under `plugins/<id>`; the bundled plugins are the **Changelog Generator**
and **Contributors** (who contributed to Core + Gutenberg in a period — the
make.wordpress.org "Month in Core" analysis), both built on shared, plugin-facing
Core services in `src/lib/`.

Human docs: the **[Handbook](https://unleash-wp.github.io/ai-forge/)** (the single
source of truth) and `CONTRIBUTING.md`. This file is the quick map for agents
working *in* the repo.

## Task: produce a release changelog / post

1. Ask the user (or infer) the **start date, end date, and milestone** (e.g. `7.1`).
2. Run (from a checkout, the entry is `bin/ai-forge.mjs`; installed, it's `uwp-ai-forge`):
   ```bash
   node bin/ai-forge.mjs changelog --since <start> --until <end> --milestone <x.y> --post
   ```
   - `--post` → a ready-to-edit release-post template (headline, count line, the
     two canonical source links, a highlights placeholder, and the grouped changelog).
   - no flag → full technical report (summary table + grouped changelog).
   - `--json` → structured data.
3. **Read the tickets before writing.** The CLI gives ticket numbers, summaries
   and metadata cookie-free, but not the descriptions. Add `--deep` for those:
   ```bash
   WPORG_TRAC_COOKIE='<wp.org cookie>' node bin/ai-forge.mjs changelog \
     --since <start> --until <end> --milestone <x.y> --deep --json
   ```
   No cookie → descriptions can't be read; ground the prose in the summaries +
   full Core changeset commit messages, and say descriptions were not read.
4. **Every highlight sentence must trace to a real PR or Trac ticket you read.**
   Link inline. Never invent features or estimate counts — the tool's numbers and
   links are the source of truth.

## Task: who contributed / a "Month in Core" post

```bash
node bin/ai-forge.mjs contributors --month 2025-10 --companies
```
- Ranks contributors (Core props ∪ Gutenberg commits). Window: `--month YYYY-MM` |
  `--quarter YYYY-Qn` | `--since --until`. `--companies` = employer / "which company
  invested most"; `--svg <file>` writes a chart image; `--json` = structured data.
- In chat the MCP tools are `get_contributors` (flags `companies` / `committers` /
  `components` / `tickets`; `format=json`; `top=N` caps table rows for context
  budget) and `draft_month_in_core` (full post scaffold; highlights left as TODOs).
- **Identity:** Gutenberg GitHub logins and Core wp.org usernames are merged to one
  wp.org identity (GitHub `t-hamano` = wp.org `wildworks`) so counts don't
  double-count. Country/geography is not on wp.org profiles — never fabricated.

## Optional

- `gh auth login` raises the GitHub API rate limit from 60/h to 5000/h.
- `node bin/ai-forge.mjs serve` opens the browser app at http://localhost:4321.
- `npm test` runs the unit tests; `npm run build` builds the browser bundle.

## Where things are

- `bin/ai-forge.mjs` — CLI entry (dispatches `serve`, `mcp`, `update`, `changelog`, …).
- `src/` — the core platform: `server.mjs` (the `serve` shell), `mcp-server.mjs`
  (the `mcp` stdio server), `plugins.mjs` (the plugin loader), `connectors/` (GitHub +
  wordpress.org credential stores and the connector registry).
- `plugins/<id>/` — a plugin: `plugin.json` (manifest) + `server.mjs` (exports
  `routes` / `mcpTools` / `skills` / `commands`) + `client.jsx` (the React UI).
  Bundled plugins ship here; community installs land in `~/.config/uwp-ai-forge/plugins`.
- `src/lib/` — **shared, plugin-facing Core services** (import via `../../src/lib/…`):
  `wp-contributors` (rank + tally), `wp-commits` (cached GitHub commit fetch),
  `wp-profiles` (employer + GitHub→wp.org identity resolution), `wp-components`,
  `wp-tickets`, `wp-branches`, plus `cache-store` (disk cache: `UWP_CACHE_DIR`,
  `UWP_OFFLINE`) and `net` (fetch `timeoutSignal` + a bounded concurrency `pool`).
- `plugins/changelog/lib/report.mjs` — fetch + aggregate pipeline (now on `src/lib`);
  `plugins/changelog/lib/format.mjs` — Markdown report + post template.
- `plugins/contributors/lib/` — `report.mjs` (build + identity dedup + company fold),
  `format.mjs` (Markdown / `capReport` context-cap / `monthInCorePost`), `charts.mjs`.
- Sources: Gutenberg = `WordPress/gutenberg`; Core = `WordPress/wordpress-develop`
  mirror; Core grouping = `WordPress/Documentation-Issue-Tracker` dev-notes tracker.

## Lumo — the knowledge extension

AI Forge is the platform; **Lumo** (`github:unleash-wp/lumo`) feeds it curated,
source-verified WordPress knowledge as a community plugin (installs to
`~/.config/uwp-ai-forge/plugins/lumo`). Tools it adds to `uwp mcp`:
`forge_wp_lookup` (topic → wrong-vs-correct pattern + source + verify step, from
the bundled snapshot) and `forge_wp_check_code` (live catch, delegated to the
installed `@unleashwp/lumo` engine — never reimplemented; degrades to an
install hint).

## Hosting-safe caching + release

- wp.org + GitHub responses are disk-cached. To not get blocked by Automattic on a
  server: `uwp contributors ingest-profiles …` (online, paced by `UWP_FETCH_RPS`)
  warms the shared cache; the app then runs with `UWP_OFFLINE=1` and only reads it.
  Fetch timeout: `UWP_FETCH_TIMEOUT_MS` (default 20s).
- Release: bump `package.json`, push a `vX.Y.Z` tag → `.github/workflows/release.yml`
  runs the version-sync check + build + tests, then publishes npm (provenance) +
  a GitHub Release (`.mcpb`) + GitHub Packages. Idempotent. Do **not** add a Claude
  co-author trailer to commits on this repo.
