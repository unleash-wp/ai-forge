# FAQ

### Do I need a GitHub account?

No. A token is optional — it raises the API limit from 60 to 5,000 requests per hour. Forge reads only public repositories, so the token needs **no scopes**.

### What is deep mode?

It adds the full Trac ticket text (description + real component) to each change. It needs the **wordpress.org cookie** connector. Without it, Forge grounds the changelog in ticket summaries and Core commit messages instead. See [Connectors](Connectors).

### Where are my keys stored?

On your machine, in owner-only files under `~/.config/wp-trac/`. They are never printed and are sent only to GitHub / WordPress.org. Environment variables (`GITHUB_TOKEN`, `WPORG_TRAC_COOKIE`) always take precedence and are read live.

### Is it safe to run the local server?

Yes. The server refuses **cross-site** state-changing requests — a web page open in your browser cannot POST a cookie or token to `localhost`. Only same-origin app requests and non-browser callers (the CLI, the MCP app) can write. Reads return only public data.

### Do I need to install Node for Claude Desktop?

No. The `.mcpb` bundle runs on the Node that Claude Desktop ships. For the terminal and the Claude Code / Codex MCP paths you need **Node ≥ 18**.

### Why does it need `git`?

Forge lists branches with `git ls-remote`, which is **not** subject to the GitHub API rate limit — so the milestone/branch pickers keep working even when a token is throttled. If `git` is unavailable it falls back to the REST API.

### How do I update Forge?

- **npm / npx:** `npx @unleashwp/ai-forge@latest …` always uses the current release; a global install updates with `npm i -g @unleashwp/ai-forge@latest`.
- **Claude Code / Codex:** the MCP command uses `@latest`, so it updates itself.
- **Claude Desktop:** re-pack (`npm run mcpb:pack`) and reinstall the `.mcpb`.
- **Dev clone:** `git pull && npm install`.

### The counts look off / a ticket is Uncategorized — why?

Tickets are grouped by joining against the docs-team dev-notes tracker. A ticket newer than the tracker's snapshot, in an excluded component, or a version bump lands under **Uncategorized**. The counts themselves come from the Core git mirror's commit messages (`Fixes #NNNNN`), not from Trac. See [The Changelog Tool](The-Changelog-Tool).

### Can I add my own tool?

Yes — every tool is a folder under `tools/`. See [Building a Tool](Building-a-Tool).

### Is this affiliated with WordPress or Automattic?

No. It's an independent project by Benjamin Zekavica (Morvance), not linked to the WordPress Foundation or Automattic Inc.
