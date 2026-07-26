# The Changelog Tool

The first plugin AI Forge ships with (bundled, free) — one tool on the platform, not a core feature. Give it a date window and a milestone; it produces a grounded release-post changelog for WordPress Core + Gutenberg.

## Command

```bash
ai-forge changelog --since <YYYY-MM-DD> --until <YYYY-MM-DD> [options]
```

| Flag | Effect |
| --- | --- |
| `--since` / `--until` | The date window (required). |
| `--milestone x.y` | Sets the Gutenberg branch to `wp/<x.y>` and enables milestone-aware ticket counting. |
| `--post` | Print a fill-in release-post template instead of the technical report. |
| `--json` | Structured data (for scripts / agents). |
| `--deep` | Enrich each Core change with its full Trac ticket description (needs the wordpress.org cookie — see [Connectors](Connectors)). |
| `--gb-branch <ref>` | Override the Gutenberg branch. |
| `--core-branch <ref>` | Override the Core branch. |
| `--no-labels` | Skip fetching Gutenberg `[Type]` labels. |
| `--no-dev-notes` | Skip the dev-notes classification. |

Run `ai-forge -h` for the full list.

## Where the data comes from

| Surface | Where changes live | AI Forge reads |
| --- | --- | --- |
| **Gutenberg** | GitHub PRs on `wp/<milestone>` | commits + `[Type]` labels |
| **Core** | Trac tickets, committed to SVN | the `WordPress/wordpress-develop` git mirror |
| **Core grouping** | Trac ticket metadata | the docs-team dev-notes tracker JSON (joined on ticket #) |

Core commit messages carry everything a release post needs — `Fixes #NNNNN` (the closed Trac ticket), `Props alice, bob` (contributors), and `git-svn-id: …@62815` (the changeset `r62815`) — so the git mirror gives reliable counts and links **without touching Trac**. For component grouping, each windowed ticket is joined against the dev-notes tracker (already tagged with a component and `dev-note` / `misc-dev-note` / `field-guide`). Tickets not in the tracker — newer than its snapshot, excluded components, or version bumps — land under **Uncategorized**.

Everything the CLI needs is on GitHub: **cookie-free, deterministic, runs in CI and Codex.**

## Output

- **Default** — a technical report: a summary table plus the changelog grouped by area.
- **`--post`** — a release-post template: headline, a count line, the two canonical source links (the Gutenberg compare view and the Core Trac query), a highlights placeholder, and the grouped changelog as raw material.
- **`--json`** — the full structured object: `meta`, `report` (with `core.commits[].tickets`, `byComponent`, contributors, counts), `sources`, `markdown`, `post`.

## Deep mode

`--deep` fills each change's description. The cookie-free baseline uses the Core commit body; with the wordpress.org cookie set, AI Forge additionally pulls the Trac ticket description (via the `mcp-context-wporg` provider when available) so Uncategorized changesets get their real component and full text. Without the cookie it degrades to summaries and tells you so.

## The grounding rule

AI Forge **never invents features and never estimates counts.** The numbers and links it prints are the source of truth. When you write the highlights (1–3 short paragraphs), back every sentence with a real PR or Trac ticket and link it inline.
