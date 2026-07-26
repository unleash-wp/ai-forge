# UnleashWP AI Forge — instructions for Claude Code

AI Forge is a **plugin platform for WordPress tooling** that bridges to your AI
over MCP. Zero runtime dependencies, plain Node ≥18. Every capability is a plugin
under `plugins/<id>`; the bundled one is the **Changelog Generator** — it turns a
date window into a release-post changelog for Core + Gutenberg.

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

## Good to know

- Sources: Gutenberg = `WordPress/gutenberg` (branch `wp/<milestone>`); Core =
  `WordPress/wordpress-develop` mirror; Core component grouping = the cookie-free
  `WordPress/Documentation-Issue-Tracker` dev-notes tracker.
- `gh auth login` is optional but raises the GitHub API limit to 5000/h.
- Full detail for humans: the [Handbook](https://unleash-wp.github.io/ai-forge/)
  and `CONTRIBUTING.md`. Architecture + the MCP fallback live in the skill.
