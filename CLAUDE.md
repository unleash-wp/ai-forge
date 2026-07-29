# UnleashWP AI Forge — instructions for Claude Code

AI Forge is a **plugin platform for WordPress tooling** that bridges to your AI
over MCP. Zero runtime dependencies, plain Node ≥18. Every capability is a plugin
under `plugins/<id>`; the bundled ones are the **Changelog Generator** (a date
window → a release-post changelog for Core + Gutenberg) and **Contributors** (who
contributed in a period — the make.wordpress.org "Month in Core" analysis). Both
build on shared, plugin-facing Core services in `src/lib/` (any plugin imports them
via `../../src/lib/…`).

## When the user asks for a changelog / release post

1. **Get the window + milestone** - start date, end date, milestone (e.g. `7.1`).
2. **Run the tool** (no install needed - it's zero-dep):
   ```bash
   node bin/ai-forge.mjs changelog --since <start> --until <end> --milestone <x.y> --post
   ```
   - `--post` prints a fill-in release-post template (headline, count line,
     source links, highlights placeholder + the grouped changelog).
   - Drop `--post` for the full technical report; add `--json` for raw data.
   - Prefer `uwp-ai-forge changelog …` (alias `uwp`) if the package is installed.
3. **Read the tickets** - the CLI gives ticket summaries + metadata cookie-free,
   but for the ticket description/discussion read each Core ticket
   (`core.commits[].tickets` in `--json`) via the `wporg-context` MCP
   `get-ticket {id}` (needs `WPORG_TRAC_COOKIE`). See SKILL.md step 3b.
4. **Write the post** - follow `.claude/skills/wp-release-helper/SKILL.md` and the
   grounding rules there: every prose highlight must trace to a real PR/ticket you
   read; never invent features or estimate counts.

For a click-driven UI instead of flags: `node bin/ai-forge.mjs serve`
(→ http://localhost:4321, date-range picker + Copy buttons).

## When the user asks who contributed / a "Month in Core" post

```bash
node bin/ai-forge.mjs contributors --month 2025-10 --companies
```
- Ranks contributors (Core props ∪ Gutenberg commits). Window: `--month YYYY-MM` |
  `--quarter YYYY-Qn` | `--since --until`. `--companies` adds the employer /
  "which company invested most" breakdown; `--svg <file>` writes a chart image.
- In chat, the MCP tools are **`get_contributors`** (toggle `companies` /
  `committers` / `components` / `tickets`; `format=json`; `top=N` caps table rows to
  protect context) and **`draft_month_in_core`** (assembles the whole post scaffold;
  prose highlights are left as TODOs to ground in real changesets — never invented).
- **Identity:** Gutenberg GitHub logins and Core wp.org usernames are merged to one
  wp.org identity (e.g. GitHub `t-hamano` = wp.org `wildworks`) so counts don't
  double-count. Country/geography is NOT published on wp.org profiles — never faked.

## Good to know

- Sources: Gutenberg = `WordPress/gutenberg` (branch `wp/<milestone>`); Core =
  `WordPress/wordpress-develop` mirror; Core component grouping = the cookie-free
  `WordPress/Documentation-Issue-Tracker` dev-notes tracker.
- **Shared Core services** (`src/lib/`): `wp-contributors` / `wp-commits` /
  `wp-profiles` (employer + GitHub→wp.org identity) / `wp-components` / `wp-tickets` /
  `wp-branches`, plus `cache-store` (disk cache) and `net` (fetch timeouts + a
  bounded concurrency pool). Changelog and Contributors both consume them.
- **Hosting-safe caching:** wp.org + GitHub responses are disk-cached under
  `UWP_CACHE_DIR` (default `~/.config/uwp-ai-forge`). To not hammer Automattic from
  a server: run `uwp contributors ingest-profiles …` (online, paced by
  `UWP_FETCH_RPS`) to warm the shared cache, then run the app with `UWP_OFFLINE=1`
  so it only reads the cache (never fetches profiles/Trac). Timeouts:
  `UWP_FETCH_TIMEOUT_MS` (default 20s).
- Cutting a release: bump `package.json` and push a `vX.Y.Z` tag —
  `.github/workflows/release.yml` runs the version-sync check + build + tests, then
  publishes to npm (provenance) + a GitHub Release (`.mcpb`) + GitHub Packages.
  Idempotent (re-pushing an existing version is a no-op). No Claude co-author trailer
  in commits on this repo.
- **Lumo** (`github:unleash-wp/lumo`) is the knowledge extension that feeds the
  platform: installed as a community plugin it adds `forge_wp_lookup` (curated,
  source-verified WP knowledge — deprecations, block.json/theme.json, security,
  HPOS) and `forge_wp_check_code` (the live catch, delegated to the installed
  `@unleashwp/lumo` engine; degrades to an install hint without it).
- `gh auth login` is optional but raises the GitHub API limit to 5000/h.
- Full detail for humans: the [Handbook](https://unleash-wp.github.io/ai-forge/)
  and `CONTRIBUTING.md`. Architecture + the MCP fallback live in the skill.
