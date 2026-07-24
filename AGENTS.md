# wp-release-helper — instructions for coding agents (Codex & others)

This repo turns a date window into a WordPress release-post changelog for Core +
Gutenberg. **Zero dependencies, plain Node ≥18** — nothing to install or build.

## Task: produce a release changelog / post

1. Ask the user (or infer) the **start date, end date, and milestone** (e.g. `7.1`).
2. Run:
   ```bash
   node bin/wp-release-helper.mjs --since <start> --until <end> --milestone <x.y> --post
   ```
   Output modes:
   - `--post` → a ready-to-edit release-post template (headline, "N issues"
     count line, the two canonical source links, a highlights placeholder, and
     the grouped changelog as raw material).
   - no flag → full technical report (summary table + grouped changelog).
   - `--json` → structured data for further processing.
3. Fill the highlights: **1–3 short paragraphs, each sentence backed by a real
   PR or Trac ticket from the tool output.** Link them inline. Do not invent
   features, do not estimate counts or dates — the tool's numbers and links are
   the source of truth.

## Optional

- `gh auth login` raises the GitHub API rate limit from 60/h to 5000/h.
- `node bin/wp-release-helper.mjs serve` opens a browser UI at
  http://localhost:4321 (date-range picker, Copy post / Copy Markdown).
- `npm link` installs a short `uwp` command so you can run `uwp …` instead.

## Where things are

- `bin/wp-release-helper.mjs` — CLI entry.
- `src/report.mjs` — fetch + aggregate pipeline (shared by CLI and server).
- `src/format.mjs` — Markdown report (`toMarkdown`) and post template (`toPost`).
- `src/server.mjs` — the `serve` browser UI.
- Sources: Gutenberg = `WordPress/gutenberg`; Core = `WordPress/wordpress-develop`
  mirror; Core component grouping = `WordPress/Documentation-Issue-Tracker`
  dev-notes tracker (cookie-free GitHub JSON).
