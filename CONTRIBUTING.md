# Contributing to UnleashWP Forge

Forge is a small, self-hosted toolbelt for WordPress release and dev work. The
free core is a plain Node server plus a React browser UI, and every tool is a
**plugin** - a folder under `tools/`. Adding a tool needs no changes to the
shell.

## Run it locally

```bash
git clone https://github.com/unleash-wp/wp-release-helper
cd wp-release-helper
npm install        # installs build deps + builds the UI bundle (dist/)
npm run build      # rebuild the bundle after any client change
node bin/wp-release-helper.mjs serve   # -> http://localhost:4321
```

The core CLI (`bin/` + `src/*.mjs`) has **zero runtime dependencies**. React,
webpack and Babel are build-time devDependencies that only produce the browser
bundle - they never load in the CLI. Keep it that way.

## Build a tool

A tool is a folder `tools/<id>/` with up to three files. Copy `tools/_template/`
to start:

```
tools/<id>/
  plugin.json    manifest (required)
  client.jsx     a default-exported React component (the UI)
  server.mjs     optional backend routes
```

### 1. `plugin.json` - the manifest

```json
{
  "id": "my-tool",
  "name": "My Tool",
  "description": "One line shown under the tool title.",
  "version": "0.1.0",
  "coreVersion": ">=0.1.0",
  "icon": "code",
  "author": "Your name",
  "price": "free",
  "updateSource": "github:you/your-repo"
}
```

`id` must match the folder name. `name` + `icon` render the rail entry;
`description` fills the tool head. `price` and `updateSource` are forward-looking
hooks: `updateSource` powers the free "update available" note (via GitHub
Releases); `price` stays `"free"` for community tools.

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
`../../src/client/ui` instead of styling raw elements, so every tool looks and
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
`tools/_template/client.jsx` is a working example that uses these.

### 3. `server.mjs` - optional backend

Export `routes`; the registry mounts them. Namespace paths under
`/api/<your-id>/` to avoid clashes.

```js
export const routes = [
  { method: 'GET', path: '/api/my-tool/hello',
    handler: async (req, res, url, ctx) => ctx.json(res, 200, { ok: true }) },
];
```

Import shared logic from `../../src/`. Credential/setup routes stay in the core
shell because every tool shares them.

### Register + run

`npm run build`, restart `serve`, and your tool appears in the rail. Discovery is
automatic (server: `src/plugins.mjs`; client:
`import.meta.webpackContext`). Folders starting with `_` (like `_template`) are
skipped.

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
defaults. Import those rather than raw Chakra inputs so every tool matches. The
shell components (`Header`, `Rail`, `Footer`, `SetupWizard`, `Installer`,
`PluginsManager`) are plain Chakra components under `src/client/components/`.

**The `Provider`** (`src/client/ui/Provider.jsx`) wraps the app with
`ChakraProvider value={system}` + `next-themes` for the light/dark toggle
(`defaultTheme="system"`). It's mounted once in `index.jsx`; a tool never touches
it.

**Adding a token or a variant:** extend `theme.js` (`tokens` for a raw value,
`semanticTokens` for a light/dark pair). For a reusable styled component with
variants, prefer a Chakra recipe over ad-hoc props. Keep raw hex out of
components — if you need a new colour, name it in the theme first.

Only the browser bundle depends on Chakra/Emotion (they're `devDependencies`,
bundled into `dist/main.js`). The core CLI stays zero-dependency vanilla Node and
never imports any of this.

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
