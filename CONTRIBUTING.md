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
import { useCore } from '../../src/client/core.jsx';

export default function MyTool() {
  const core = useCore(); // { toast, openSetup, status, refreshStatus }
  return <section className="filters">…your UI…</section>;
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

You can also reuse the shared design-system classes (`filters`, `card`, `empty`,
…) and add your own in `tools/<id>/client.scss` (see **Frontend & styles**
below). The shell owns the header, rail, setup wizard and toast; don't re-render
those. `tools/_template/client.jsx` is a working example that uses these.

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

Styles live in `src/styles/`, organised as **ITCSS** (Inverted Triangle CSS):
layers load from generic to specific, low specificity to high, so nothing has to
fight the cascade.

```
src/styles/
  settings/    design tokens (CSS variables), light + dark
  tools/       Sass mixins (e.g. the mq() breakpoint helper)
  generic/     resets
  elements/    bare tags (body, a, input, button …)
  objects/     layout primitives (.shell)
  components/  one BEM block per file (header, rail, wizard, select …)
  utilities/   single-purpose helpers (.tnum, .spin, .note)
  main.scss    the @use manifest — the only place layers are wired together
```

Naming is **BEM**: `.block`, `.block__element`, `.block--modifier`. State and
variants are modifiers (`.tab--active`, `.pill--ok`), never loose words. Nest
child tags and responsive rules inside the block:

```scss
@use '../tools/mixins' as *;

.rail {
  display: flex;
  &__cap { text-transform: uppercase; }       // .rail__cap
  &--collapsed { flex-direction: row; }        // .rail--collapsed
  @include mq('lg') { flex-direction: row; }   // breakpoints: sm / md / lg
}
```

**Add a component:** drop a `_name.scss` in `components/`, write one block, then
add `@use 'components/name';` to `main.scss`. Colours come from `var(--token)`
only (never hard-code a hex); prefer a spacing token (`--s1`…`--s8`) over a magic
number.

**A tool owns its styles.** Shell and design-system primitives (header, rail,
filters, `Select`, `Button`, wizard …) stay in `src/styles/`. A tool's own look
lives beside its code in `tools/<id>/client.scss`, imported at the top of its
`client.jsx`. The changelog tool is the worked example
(`tools/changelog/client.scss`). Webpack bundles every imported `.scss` into the
single `dist/main.css`, so BEM block names must stay unique across tools.

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
