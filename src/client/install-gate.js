// Whether the blocking first-run installer should run.
//
// The installer is an overlay across the whole app that asks for a GitHub token
// and a wordpress.org cookie and ends with POST /api/installed. On a public
// read-only instance the server refuses all three, so the overlay is a wall a
// visitor cannot get past in front of a product that otherwise works. The
// server never marks itself installed there either, so !status.installed alone
// stays true for every visitor forever.
//
// Plain .js, not part of core.jsx, so the rule is provable without a browser or
// a JSX build step.
export function shouldRunInstaller(status, readOnly) {
  return !!status && !status.installed && !readOnly;
}
