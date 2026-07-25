// WordPress-style actions + filters for the client. Tools and plugins register
// callbacks that the shell fires at named points, so they can extend Forge
// without touching the core. Zero-dependency, synchronous, priority-ordered.
//
//   addAction('forge.tool.open', (id) => {...});   doAction('forge.tool.open', id);
//   addFilter('forge.plugins', (list) => list);    applyFilters('forge.plugins', list);
//
// It is also exposed as window.forge.hooks so tools loaded at runtime (and the
// console) can hook in.

const store = { actions: Object.create(null), filters: Object.create(null) };

function bucket(kind, tag) {
  return store[kind][tag] || (store[kind][tag] = []);
}
function add(kind, tag, fn, priority = 10) {
  if (typeof fn !== 'function') return;
  const b = bucket(kind, tag);
  b.push({ fn, priority });
  b.sort((a, z) => a.priority - z.priority);
}
function remove(kind, tag, fn) {
  const b = store[kind][tag];
  if (b) store[kind][tag] = b.filter((h) => h.fn !== fn);
}

export function addAction(tag, fn, priority) { add('actions', tag, fn, priority); }
export function removeAction(tag, fn) { remove('actions', tag, fn); }
export function doAction(tag, ...args) {
  for (const h of store.actions[tag] || []) {
    try { h.fn(...args); } catch (e) { console.error('[forge] action "' + tag + '" failed', e); }
  }
}

export function addFilter(tag, fn, priority) { add('filters', tag, fn, priority); }
export function removeFilter(tag, fn) { remove('filters', tag, fn); }
export function applyFilters(tag, value, ...args) {
  return (store.filters[tag] || []).reduce((v, h) => {
    try { return h.fn(v, ...args); } catch (e) { console.error('[forge] filter "' + tag + '" failed', e); return v; }
  }, value);
}

export const hooks = { addAction, removeAction, doAction, addFilter, removeFilter, applyFilters };

if (typeof window !== 'undefined') {
  window.forge = window.forge || {};
  window.forge.hooks = hooks;
}
