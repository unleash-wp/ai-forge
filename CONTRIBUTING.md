# Contributing to UnleashWP AI Forge

AI Forge is UnleashWP's self-hosted **plugin platform** for WordPress (and an AI
bridge over MCP). The **core is the platform** — a plain Node server plus a React
browser UI (the shell). **Every feature is a plugin** — a folder under `plugins/`,
including the changelog. Nothing in the shell is a built-in feature; adding a plugin
needs no changes to the shell.

## Run it locally

```bash
git clone https://github.com/unleash-wp/ai-forge
cd uwp-ai-forge
npm install        # installs build deps + builds the UI bundle (dist/)
npm run build      # rebuild the bundle after any client change
node bin/ai-forge.mjs serve   # -> http://localhost:4321
```

The core CLI (`bin/` + `src/*.mjs`) has **zero runtime dependencies**. React,
webpack and Babel are build-time devDependencies that only produce the browser
bundle - they never load in the CLI. Keep it that way.

## Build a plugin

A plugin is a folder `plugins/<id>/` with up to three files. Copy `plugins/_template/`
to start:

```
plugins/<id>/
  plugin.json    manifest (required)
  client.jsx     a default-exported React component (the UI)
  server.mjs     optional backend routes
```

### 1. `plugin.json` - the manifest

```json
{
  "id": "my-tool",
  "name": "My Tool",
  "description": "One line shown under the plugin title.",
  "version": "0.1.0",
  "coreVersion": ">=0.1.0",
  "icon": "code",
  "author": "Your name",
  "price": "free",
  "updateSource": "github:you/your-repo"
}
```

`id` must match the folder name. `name` + `icon` render the rail entry;
`description` fills the plugin head. `price` and `updateSource` are forward-looking
hooks: `updateSource` powers the free "update available" note (via GitHub
Releases); `price` stays `"free"` for community plugins.

`icon` is a keyword from the built-in RemixIcon palette (unknown → a plug icon):
`code`, `git-commit`, `changelog`, `article`, `list`, `sparkling`, `magic`,
`tools`, `rocket`, `terminal`, `palette`, `plug`, `flash`. To add more, extend
the map in `src/client/icons.jsx`.

### 2. `client.jsx` - the UI

Default-export a React component. The shell mounts it in `<main>` and hands it
the core services through `useCore()`:

```jsx
import { Box } from '@chakra-ui/react';
import { useCore } from '../../src/client/core.jsx';

export default function MyTool() {
  const core = useCore(); // { toast, openSetup, status, refreshStatus }
  return <Box>…your UI…</Box>;
}
```

**Shared component library.** Import the design-system primitives from
`../../src/client/ui` instead of styling raw elements, so every plugin looks and
behaves the same:

```jsx
import { Button, TextInput, TextArea, Checkbox, Select } from '../../src/client/ui';
import { ToolIcon } from '../../src/client/icons.jsx';
```

- `Button` - `variant` (`primary` | `ghost`), `size` (`sm`), `danger`.
- `TextInput` / `TextArea` / `Checkbox` - styled inputs.
- `Select` - a custom dropdown that matches the design system; add `searchable`
  for long lists, `block` for full width. Keyboard + screen-reader accessible.

Style with Chakra props + the shared design tokens (`bg="ui.surface"`,
`color="ui.heading"`, `colorPalette="brand"`) — see **Frontend & styles** below.
The shell owns the header, rail, setup wizard and toast; don't re-render those.
`plugins/_template/client.jsx` is a working example that uses these.

### 3. `server.mjs` - optional backend

Export `routes`; the registry mounts them. Namespace paths under
`/api/<your-id>/` to avoid clashes. Each handler gets `(req, res, url, ctx)`,
where `ctx` gives you `json(res, status, obj)`, `query` (a `URLSearchParams`),
and `await body()` (the parsed JSON request body):

```js
export const routes = [
  { method: 'GET', path: '/api/my-tool/hello',
    handler: async (req, res, url, ctx) =>
      ctx.json(res, 200, { hello: ctx.query.get('who') || 'world' }) },
  { method: 'POST', path: '/api/my-tool/save',
    handler: async (req, res, url, ctx) => {
      const { value } = await ctx.body();
      ctx.json(res, 200, { saved: value });
    } },
];
```

Import shared logic from `../../src/`. Credential/setup routes stay in the core
shell because every plugin shares them.

**Terminal commands.** Export `commands` and your plugin is runnable from the CLI
as `uwp <name> …` — handy for scripting or feeding data to Claude Code / Codex.
Each command gets `(args, ctx)`: `args` is the parsed flags (`args._` holds
positionals), `ctx` is `{ log, error }`. They show up under `uwp -h`.

```js
export const commands = [
  { name: 'my-tool', summary: 'What it prints.',
    run: async (args, ctx) => ctx.log(JSON.stringify({ ok: true, args: args._ })) },
];
```

The Changelog plugin does this: `uwp-ai-forge changelog --since <date> --until
<date> [--milestone x.y] [--post|--json]` (alias `uwp changelog …`).

**MCP tools.** Export `mcpTools` and `uwp mcp` serves them over stdio (the MCP
transport), so Claude Code and Codex register AI Forge once and call your tool
live. Each tool has a JSON-Schema `inputSchema`; `run(args)` returns a string
(or any value, JSON-stringified). `uwp mcp` aggregates the tools from every
installed plugin.

```js
export const mcpTools = [
  { name: 'my_tool_echo', description: 'Echo text back.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    run: async (args) => `you said: ${args.text}` },
];
```

Register the server (named `forge`; the command it runs is `uwp mcp`): Claude
Code `claude mcp add uwp-ai-forge -- uwp mcp`; Codex adds an MCP server with
`command = "uwp"`, `args = ["mcp"]`. Keep `stdout` for JSON-RPC only — send any
logging to `stderr`. The Changelog plugin ships `get_changelog`, `list_milestones`
and `list_branches` tools plus a `write_release_post` skill (MCP prompt).

**Skills.** Export `skills` — reusable AI instructions your plugin provides. They
are served as MCP prompts over `uwp mcp` (so Claude Code / Codex can pull them)
and printed by `uwp skills [<name>]`. `build(args)` returns the prompt text.

```js
export const skills = [
  { name: 'my_tool_howto', description: 'How to use my-tool.',
    arguments: [{ name: 'topic', required: false }],
    build: (args) => `Use the my_tool_echo tool to handle: ${args.topic}.` },
];
```

**MCP Apps (interactive panels).** Export `uiResources` — self-contained HTML
panels that Claude Desktop / Codex render in a sandboxed iframe *inside the
conversation* (no browser). Link a tool to one with a `ui` field, and return
`{ text, structured }` from its `run` — the host pushes `structured` to the
panel, which renders it and can call your tools back via postMessage.

```js
export const uiResources = [
  { uri: 'ui://my-tool/panel', name: 'panel', description: '…',
    html: readFileSync(new URL('./app.html', import.meta.url), 'utf8'),
    permissions: { clipboardWrite: {} } },
];
export const mcpTools = [
  { name: 'show_thing', description: '…', ui: 'ui://my-tool/panel',
    inputSchema: { /* … */ },
    run: async (a) => ({ text: 'summary', structured: { /* data the panel renders */ } }) },
];
```

The panel HTML speaks the MCP Apps postMessage dialect (`ui/initialize`, then
handle `ui/notifications/tool-result`); see `plugins/changelog/app.html` for a
zero-dependency vanilla example. The Changelog plugin ships `show_changelog`.

### Register + run

Scaffold from the template with `npm run new-tool -- <id> [Display Name]` (copies
`plugins/_template` to `plugins/<id>/` and patches the manifest), or copy the folder
by hand. Then `npm run build` (or `npm run watch` for a rebuild-on-save loop),
restart `serve`, and your plugin appears in the rail. Discovery is automatic
(server: `src/plugins.mjs`; client: `import.meta.webpackContext`). Folders
starting with `_` (like `_template`) are skipped, and a plugin whose manifest
`coreVersion` the running core does not satisfy is skipped with a console note.

## Frontend & styles

Styling is **Chakra UI v3** (Emotion under the hood). There is no CSS/SCSS file:
styles are injected at runtime from the theme + the props you write on
components. There is nothing to import, no cascade to fight, no class names to
keep unique. `npm run build` emits `dist/main.js` only — no `main.css`.

**One design system, in `src/client/theme.js`.** It maps the UnleashWP brand
(navy, yellow) and the light/dark surface/text palette to Chakra tokens via
`createSystem` + `defineConfig`. Two token families you'll use constantly:

- **`ui.*` semantic tokens** — colour-mode-aware, so you never hard-code a hex or
  write a dark-mode branch. `ui.surface`, `ui.sunk`, `ui.border`, `ui.heading`,
  `ui.text`, `ui.muted`, `ui.primary`, `ui.accent`, `ui.good`, `ui.bad`, plus the
  `sm`/`md`/`lg` shadow tokens. Each already resolves to the right value in light
  and dark.
- **`colorPalette="brand"`** — hand it to any interactive Chakra component
  (`Button`, `Checkbox`, `Tabs`, `Badge`) to theme it in brand navy.

```jsx
import { Box, Heading, Text, Button } from '@chakra-ui/react';

<Box bg="ui.surface" borderColor="ui.border" borderWidth="1px" rounded="forge" p={4}>
  <Heading size="md" color="ui.heading">Title</Heading>
  <Text color="ui.muted">Body</Text>
  <Button colorPalette="brand">Do it</Button>
</Box>
```

**Reach for the right primitive** instead of nesting `Box`es: `Stack`/`HStack`
for flow, `Grid`/`SimpleGrid` for columns, `Flex` for explicit layout. Responsive
props are mobile-first objects — `columns={{ base: 1, md: 2 }}`,
`direction={{ base: 'column', md: 'row' }}`. The theme defines custom breakpoints
`sm 560 / md 640 / lg 780` to match the old layout.

**Shared primitives live in `src/client/ui/`** (`Button`, `Select`, `TextInput`,
`TextArea`, `Checkbox`) — thin wrappers over Chakra that fix the app's API and
defaults. Import those rather than raw Chakra inputs so every plugin matches. The
shell components (`Header`, `Rail`, `Footer`, `SetupWizard`, `Installer`,
`PluginsManager`) are plain Chakra components under `src/client/components/`.

**The `Provider`** (`src/client/ui/Provider.jsx`) wraps the app with
`ChakraProvider value={system}` + `next-themes` for the light/dark toggle
(`defaultTheme="system"`). It's mounted once in `index.jsx`; a plugin never touches
it.

**Adding a token or a variant:** extend `theme.js` (`tokens` for a raw value,
`semanticTokens` for a light/dark pair). For a reusable styled component with
variants, prefer a Chakra recipe over ad-hoc props. Keep raw hex out of
components — if you need a new colour, name it in the theme first.

Only the browser bundle depends on Chakra/Emotion (they're `devDependencies`,
bundled into `dist/main.js`). The core CLI stays zero-dependency vanilla Node and
never imports any of this.

## Translations

The UI is translatable the WordPress way: every `languages/<code>.json` is loaded
automatically, so **adding a language is one JSON file, no code change**. The key
is the English source string, the value is the translation:

```json
{ "No changelog yet": "Noch kein Changelog", "Generate": "Generieren" }
```

Copy `languages/de.json` to `languages/fr.json`, translate the values, and French
shows up in Settings → General → Language (add its display name + flag to
`LOCALE_NAMES` / `LOCALE_FLAGS` in `src/client/i18n.jsx`). Missing keys fall back
to English. In components, wrap strings with `const t = useT();` → `{t('Generate')}`;
outside React use `__('Generate')`. Wrapping more strings only helps translators.

## Hooks & filters

Plugins extend the shell without editing it, WordPress-style. `src/client/hooks.js`
exports `addAction`/`doAction` and `addFilter`/`applyFilters` (priority-ordered),
also on `window.forge.hooks` and the `core` context.

```js
import { addFilter, addAction } from '../../src/client/hooks.js';
addFilter('forge.plugins', (list) => [...list, myTool]);   // add/hide/reorder rail tools
addAction('forge.tool.open', (id) => { /* react when a tool opens */ });
```

Fire your own points from a plugin with `doAction('mytool.thing', data)` /
`applyFilters('mytool.value', value)` so other plugins can hook in.

## Quality gate

CI runs on every push and PR: build the bundle, `node --check` the modules, and
`node --test`. Keep it green.

```bash
npm run build
node --check src/*.mjs bin/*.mjs webpack.config.cjs
node --test
```

Add tests under `test/` for logic you add. Match the existing style; keep changes
surgical.

## License

By contributing you agree your work is licensed under **GPL-2.0-or-later**, like
the rest of the project.
