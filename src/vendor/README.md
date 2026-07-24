# Vendored third-party assets

Bundled here so the browser UI is fully self-contained (no CDN call, works offline)
and the project stays zero-install.

## FlexiDatepicker `1.1.5`

- Source: <https://github.com/leoanangmh/flexidatepicker>
- Files: `flexidatepicker.min.css`, `flexidatepicker.umd.min.js`
- License: MIT © leoanangmh

Served by `src/server.mjs` at `/vendor/flexidatepicker.css|.js` and themed to the
UnleashWP palette via CSS overrides in the page (the library exposes
`--mrdp-primary-color` / `--mrdp-primary-light`).
