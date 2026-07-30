// Build-time plugin registry: maps every plugins/<id>/client.jsx to its default-
// exported React component. A contributor adds a folder + `npm run build`; the
// rail (fed by /api/plugins) then mounts the matching component here.
// Uses webpack 5's ESM-native context API (require.context is not resolved
// inside ES modules).
const ctx = import.meta.webpackContext('../../plugins', {
  recursive: true,
  regExp: /^\.\/(?!_)[^/]+\/client\.jsx$/, // skip _template etc.
});

// Community installs live in the user config dir, which webpack cannot reach —
// rebuild() stages their client.jsx into plugins-community/ before building.
// Same shape, second context; bundled plugins win on id collision (a community
// plugin must not shadow a shipped tool's UI).
const communityCtx = import.meta.webpackContext('../../plugins-community', {
  recursive: true,
  regExp: /^\.\/(?!_)[^/]+\/client\.jsx$/,
});

const REGISTRY = {};
communityCtx.keys().forEach((key) => {
  const id = key.split('/')[1];
  REGISTRY[id] = communityCtx(key).default;
});
ctx.keys().forEach((key) => {
  const id = key.split('/')[1]; // './changelog/client.jsx' -> 'changelog'
  REGISTRY[id] = ctx(key).default;
});

export default REGISTRY;
