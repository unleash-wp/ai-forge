# UnleashWP AI Forge

**The AI tool for WordPress, by [UnleashWP](https://unleash-wp.com).**

Forge is a small program you run on your own computer. It is two things at once:

- **A home for WordPress tools.** Every tool is a plugin. You keep the ones you want; Forge runs them and gives them one clean interface.
- **A bridge to your AI.** Forge plugs into Claude Code, Claude Desktop and Codex, so your assistant can use those tools directly and hand you the results.

It comes with **one plugin to start: the Changelog Generator** — it builds the list of everything that changed in a WordPress release between two dates, ready to paste into a release post. More plugins will follow; the changelog is just the first, not the whole of Forge.

This page shows you how to install Forge and try that first plugin. You can use it three ways: type one command, click buttons in your browser, or just **ask Claude or Codex**.

---

## 🪄 Easiest way: let Claude or Codex install it for you

Do you use [Claude Code](https://claude.com/claude-code) or Codex? Then you don't have to do anything yourself.

**Copy the whole box below, paste it as your message, and send it.** Your assistant will install Forge, connect it, test it, and walk you through the rest — one step at a time.

```text
Install "UnleashWP AI Forge" for me and walk me through it step by step. It is an
npm package called @unleashwp/forge (its command is "ai-forge"). Do the work
yourself, run the commands, and after each step tell me in one plain sentence what
happened. Stop and ask me whenever something needs a decision.

Please do these steps in order:
1. Check I have Node 18 or newer: run `node -v`. If it is missing or older, tell me
   how to get it from https://nodejs.org and stop there.
2. Install Forge for me: `npm install -g @unleashwp/forge`. Then prove it worked by
   running `ai-forge -h`.
3. Connect Forge to you, so from now on I can just ask you for changelogs:
   - Claude Code: `claude mcp add forge -- npx -y @unleashwp/forge@latest mcp`
   - Codex: add an MCP server with command "npx" and
     args ["-y", "@unleashwp/forge@latest", "mcp"]
4. Test it: run
   `ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post`
   and show me the result.
5. Only if I say yes: help me add an optional GitHub token (for a higher rate
   limit) and a wordpress.org cookie (for full ticket text). Otherwise skip this.
6. Finish by telling me, in plain words, the three ways I can use Forge from now on:
   a terminal command, a browser page (`ai-forge serve` at http://localhost:4321),
   or simply asking you.

Go one step at a time and keep it simple.
```

That's it. It checks your computer, installs Forge, hooks it up to your assistant, tests it, and shows you how to use it.

---

## 🧑‍💻 Other easy way: one command

Prefer to do it yourself? You need one free program first: **[Node.js](https://nodejs.org), version 18 or newer** (it runs tools like this). Then run:

```bash
npm install -g @unleashwp/forge
```

Now you have a command called **`ai-forge`**. Try it:

```bash
ai-forge changelog --since 2026-07-15 --until 2026-07-22 --milestone 7.1 --post
```

This prints a ready-to-edit release post for WordPress 7.1 between those two dates. Change the dates and the milestone to whatever you need.

No account. No password. Nothing to sign up for. It just works.

---

## How do I actually use it?

Pick whatever feels comfortable:

- **Type a command** — like the example above. Run `ai-forge -h` to see everything it can do.
- **Click instead of type** — run `ai-forge serve`, then open **http://localhost:4321** in your browser. Pick your dates, press a button, copy the result.
- **Just ask your AI** — once it's connected (the magic box above), say: *"Give me the WordPress 7.1 changelog for July 15 to 22, as a post."* Claude or Codex does the rest.

---

## Do I need a GitHub token or a password?

**No. Everything works without one.** Two things are *optional* and only make it a bit nicer:

- **A GitHub token** — lets Forge ask GitHub more often per hour. No password, no special permissions. Skip it unless Forge tells you it hit a limit.
- **A wordpress.org login cookie** — turns on "deep mode", which adds the full ticket text to each change. Only if you want that extra detail.

You can add both later, inside the app, on the **Settings → Connectors** screen. They stay on your own computer and are never shared.

---

## Want more?

- **[Quick Start](QUICKSTART.md)** — the short version of this page.
- **[Wiki](https://github.com/unleash-wp/ai-forge/wiki)** — every detail: install options, connectors, using Forge from Claude & Codex, and building your own tool.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — add your own tool. Every tool is just a folder.

---

*An independent project by Benjamin Zekavica (Morvance). Not affiliated with the WordPress Foundation or Automattic Inc.*
