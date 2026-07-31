# Community plugin UI staging

rebuild() syncs installed community plugins' client.jsx here so the
webpack registry can bundle them. Webpack contexts cannot reach outside the
project, and user installs live in ~/.config. Everything except this README
is generated and gitignored.
