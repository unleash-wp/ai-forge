# Using AI Forge from Claude & Codex

AI Forge is a **Model Context Protocol (MCP) server**. Register it once, and Claude Code or Codex can call its tools live and keep working with the results. No copy-pasting from a terminal.

## Register it

```bash
# Claude Code
claude mcp add uwp-ai-forge -- npx -y @unleashwp/ai-forge@latest mcp
```

For **Codex**, add an MCP server to your config with:

```
command = "npx"
args    = ["-y", "@unleashwp/ai-forge@latest", "mcp"]
```

The server is named **`forge`** and runs over stdio. `npx @latest` means it always fetches the current published version.

> Prefer no npm at all? In **Claude Desktop**, install the `.mcpb` bundle instead (see [Installation](Installation)). It bundles the code and prompts for credentials on install.

## Then just ask

> "Give me the WordPress 7.1 release changelog for July 15–22, as a post."

The agent picks the right tool, fills in the dates and milestone, and drafts the post grounded in the real PRs and tickets.

## Tools it exposes

| Tool | What it returns |
| --- | --- |
| `get_changelog` | The release-post changelog for a date window (markdown / post / json). |
| `show_changelog` | Opens an interactive changelog panel **inside the conversation**. |
| `list_milestones` | Release milestones, from the Gutenberg `wp/x.y` branches. |
| `list_branches` | Branches for a repo (`gutenberg` or `core`). |
| `open_forge` | Opens the full AI Forge app as a window in the conversation. |

## Skills (prompts)

AI Forge also ships **skills**: reusable AI instructions served as MCP prompts:

- `write_release_post`: teaches the agent to draft a release post from the changelog data while respecting the grounding rule (every highlight traces to a real PR or ticket).

List them from the CLI with `uwp-ai-forge skills`, or print one with `uwp-ai-forge skills write_release_post`.

## The app window (MCP Apps)

`open_forge` and `show_changelog` render the actual AI Forge React UI as a **sandboxed window inside Claude Desktop / Codex**. It is the same interface you get in the browser, but with no browser involved. The window talks back to AI Forge over the MCP connection.

## Deep mode from an agent

Ask for "deep" or "full ticket text" and the agent adds `--deep`. That enriches each change with its Trac ticket description if the wordpress.org cookie connector is set. Without it, AI Forge degrades gracefully to summaries and says so. See **[Connectors](Connectors)**.

## Grounding

Whatever the surface, the rule holds: **every highlight must trace to a real PR or ticket the tool returned.** AI Forge never invents features and never estimates counts. It hands the agent real numbers and links, and the agent should keep the prose tied to them.
