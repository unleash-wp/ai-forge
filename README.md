# UnleashWP AI Forge

**The AI tool for WordPress, by [UnleashWP](https://unleash-wp.com).**

AI Forge is a small program you run on your own computer. It is two things at once:

- **A home for WordPress plugins.** You keep the ones you want; AI Forge runs them and gives them one clean interface.
- **A bridge to your AI.** AI Forge plugs into Claude Code, Claude Desktop and Codex, so your assistant can use those plugins directly and hand you the results.

It comes with **one plugin to start: the Changelog Generator**. It builds the list of everything that changed in a WordPress release between two dates, ready to paste into a release post. More plugins will follow.

You can use it three ways: type one command, click buttons in your browser, or just **ask Claude or Codex**.

---

## Product family (UnleashWP)

English is the default product language across UnleashWP. Know which name is which:

| Product | What it is | Language |
| --- | --- | --- |
| **AI Forge** | **Host / plugin runtime:** local WordPress tooling (changelog, Trac, GitHub, plugin shelf). Not a knowledge substitute. | English default; **German (DE)** optional in the local app UI (`languages/de.json`) |
| **Lumo Free** | **AI Forge plugin** (`github:unleash-wp/lumo`): Free snapshot knowledge + catch on `uwp mcp`. The `@unleashwp/lumo` npm package supplies the live catch engine. **Not** Pro. | English |
| **Lumo Pro** | **Separate hosted MCP** at `mcp.unleash-wp.com` (Mittwald): licensed live catalogue, catch, evidence. Connect from Cursor/Claude **alongside** Forge, not instead of it. | English |
| **AI Forge Hosted** | Planned managed Forge for paid Lumo seats. **Not live yet.** | English |

**How Forge and Lumo work together:** AI Forge is the host. Install **Lumo Free as a Forge plugin** (Plugins → paste `github:unleash-wp/lumo`) for the Free tier: `lumo_lookup` and `lumo_check_code` on `uwp mcp`, backed by the bundled snapshot. **Lumo Pro** is a separate hosted MCP you add in your editor when you have a paid license; it does not replace Forge, and Free-on-Forge must not pretend to be Pro. Use Forge for wp.org release tooling and scaffolding; use Lumo (Free plugin or Pro MCP) for curated wrong→correct patterns and catch. Forge does not proxy wp.org through the Pro server.

AI Forge runs on your machine (`npm install -g @unleashwp/ai-forge` ships a prebuilt browser bundle; plugin install works without webpack). Lumo Pro connects at `https://mcp.unleash-wp.com/mcp`.

---


## Install in about a minute

**Using Claude Code?** Add it as a plugin: two lines, then restart:

```text
/plugin marketplace add unleash-wp/ai-forge
/plugin install uwp-ai-forge@unleashwp-ai-forge
```

**Prefer the command line?** You need [Node.js](https://nodejs.org) 18 or newer, then:

```bash
npm install -g @unleashwp/ai-forge
```

That puts `uwp-ai-forge` on your PATH (`uwp` and `forge` are aliases).

---

## Connect WordPress.org: required

AI Forge reads WordPress.org Trac to count changes and contributors. Trac blocks
logged-out scripts with a bot wall, so **without a logged-in WordPress.org session
the contributor and Core ticket counts come back inaccurate.** Connect once.
AI Forge imports the cookie from a browser you're already signed in to:

```bash
uwp-ai-forge cookie-import <chrome|safari|firefox|edge>
```

Or open the app (`uwp-ai-forge serve`), go to **Setup → Connectors**, and sign in
to WordPress.org there. The cookie stays on your own computer and is sent only to
WordPress.org. Until you connect, the tools refuse rather than return wrong numbers.

---

## Let your AI install it for you

Use Claude Code or Codex? Paste this and send it:

```text
Install "UnleashWP AI Forge" (npm package @unleashwp/ai-forge, command
"uwp-ai-forge"). First ask me whether I want to use its browser app or do
everything here in chat, then do the setup yourself: install it, connect it to
you as an MCP server, and connect WordPress.org (required, or the counts are
wrong). Run the commands, and after each step tell me in one sentence what
happened. Stop and ask me only when something truly needs my decision.
```

Your assistant checks Node, installs AI Forge, wires it up, walks you through the
required WordPress.org connection, and tests it.

---

## Use it

- **Type a command.** Run `uwp-ai-forge -h` to see everything it can do:
  ```bash
  uwp-ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
  ```
- **Click instead of type.** Run `uwp-ai-forge serve`, then open **http://localhost:4321**. Pick your dates, press a button, copy the result.
- **Just ask your AI** once it's connected:
  - *"Give me the WordPress 7.1 changelog for July 15 to 22, as a post."*
  - *"Draft the WordPress 7.1 release post and link every highlight to its source."*

---

## Do I need a GitHub token?

**No. That one is optional.** A GitHub token only lets AI Forge ask GitHub more
often per hour (60 → 5,000). No password, no special permissions. Add it later in
**Settings → Connectors** if AI Forge tells you it hit a limit.

(The **WordPress.org connection above is required**. That's the one credential
AI Forge can't work correctly without.)

---

## Want more?

- 📖 **[Handbook](https://unleash-wp.github.io/ai-forge/)**: the complete guide to what it is, all install paths, example prompts, connectors, the changelog generator, and how to build a plugin.
- **[Quick Start](QUICKSTART.md)**: the short version of this page.
- **[Wiki](https://github.com/unleash-wp/ai-forge/wiki)**: reference pages on GitHub.
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: add your own plugin. Every plugin is just a folder.

---

*An independent project by UnleashWP (Benjamin Zekavica, Morvance). Not affiliated with the WordPress Foundation or Automattic Inc.*
