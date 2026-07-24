// Build-time tool registry: maps every tools/<id>/client.jsx to its default-
// exported React component. A contributor adds a folder + `npm run build`; the
// rail (fed by /api/plugins) then mounts the matching component here.
// Uses webpack 5's ESM-native context API (require.context is not resolved
// inside ES modules).
const ctx = import.meta.webpackContext('../../tools', {
  recursive: true,
  regExp: /^\.\/[^/]+\/client\.jsx$/,
});

const REGISTRY = {};
ctx.keys().forEach((key) => {
  const id = key.split('/')[1]; // './changelog/client.jsx' -> 'changelog'
  REGISTRY[id] = ctx(key).default;
});

export default REGISTRY;
