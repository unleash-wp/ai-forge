// Listen address and Host-header policy for `uwp serve`. The browser UI has no
// user-authentication layer, so it must stay on loopback until hosted auth exists.

function isLoopbackHost(host) {
  const h = (host || '').toLowerCase();
  const ipv4 = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  return h === 'localhost'
    || h.endsWith('.localhost')
    || h === '::1'
    || h === '0:0:0:0:0:0:0:1'
    || Boolean(ipv4 && ipv4.slice(1).every((part) => Number(part) <= 255));
}

export function resolveListen({ port: cliPort } = {}) {
  const port = Number(process.env.PORT) || Number(cliPort) || 4321;
  const host = (process.env.UWP_BIND || '127.0.0.1').trim() || '127.0.0.1';
  return { host, port };
}

export function isPublicBind(host) {
  const h = (host || '').toLowerCase();
  if (!h || isLoopbackHost(h)) return false;
  return true;
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
  if (isLoopbackHost(host)) return true;
  return allowedHosts.includes(host);
}

/** Refuse to expose the browser UI until it has real hosted-user authentication. */
export function assertPublicBindSafe(listen) {
  if (!isPublicBind(listen.host)) return;
  throw new Error(
    'uwp: public browser hosting is not supported. Keep UWP_BIND on loopback; ' +
    'a hosted deployment requires user authentication that AI Forge does not yet provide.',
  );
}
