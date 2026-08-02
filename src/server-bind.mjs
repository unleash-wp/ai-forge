// Listen address and Host-header policy for `uwp serve`. Local default stays
// 127.0.0.1 with the loopback-only guard. Public bind (0.0.0.0 / ::) is allowed
// only when UWP_FORGE_TOKEN and UWP_ALLOWED_HOSTS are set — see assertPublicBindSafe.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveListen({ port: cliPort } = {}) {
  const port = Number(process.env.PORT) || Number(cliPort) || 4321;
  const host = (process.env.UWP_BIND || '127.0.0.1').trim() || '127.0.0.1';
  return { host, port };
}

export function isPublicBind(host) {
  const h = (host || '').toLowerCase();
  if (!h || h === '127.0.0.1' || h === 'localhost' || h === '::1') return false;
  return h === '0.0.0.0' || h === '::' || !LOCAL_HOSTS.has(h);
}

export function parseAllowedHosts() {
  return (process.env.UWP_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Host header check: loopback names always pass; deployed names need UWP_ALLOWED_HOSTS. */
export function isAllowedHost(req, allowedHosts = parseAllowedHosts()) {
  let host = (req.headers.host || '').toLowerCase();
  if (!host) return true;
  host = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
  if (LOCAL_HOSTS.has(host) || host.endsWith('.localhost')) return true;
  return allowedHosts.includes(host);
}

/** Refuse to listen on a public address without explicit hosted auth config. */
export function assertPublicBindSafe(listen) {
  if (!isPublicBind(listen.host)) return;
  if (!(process.env.UWP_FORGE_TOKEN || '').trim()) {
    throw new Error(
      'uwp: UWP_BIND is not loopback but UWP_FORGE_TOKEN is unset. ' +
      'Set UWP_FORGE_TOKEN to a long random secret before binding publicly.',
    );
  }
  if (!parseAllowedHosts().length) {
    throw new Error(
      'uwp: public bind requires UWP_ALLOWED_HOSTS (comma-separated hostnames the proxy sends). ' +
      'Example: UWP_ALLOWED_HOSTS=forge.example.com',
    );
  }
}
