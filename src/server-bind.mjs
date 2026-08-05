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

/**
 * Path prefix this instance is served under, '' when it owns its own root.
 *
 * A hosted Forge sits behind lumo-pro at mcp.unleash-wp.com/forge/, because it
 * is the same product with a graphical face rather than a second one. The proxy
 * strips the prefix before forwarding, so routing here never sees it -- only
 * the HTML shell needs it, for asset URLs and for the base the client resolves
 * its /api calls against.
 *
 * Normalised so the value is either '' or '/something' with no trailing slash;
 * '/forge/' and 'forge' both mean the same thing to whoever sets the variable.
 */
export function basePath() {
  const raw = (process.env.UWP_BASE_PATH || '').trim();
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

/** Host header check: loopback names always pass; deployed names need UWP_ALLOWED_HOSTS. */
export function isAllowedHost(req, allowedHosts = parseAllowedHosts()) {
  let host = (req.headers.host || '').toLowerCase();
  if (!host) return true;
  host = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
  if (isLoopbackHost(host)) return true;
  return allowedHosts.includes(host);
}

/**
 * Public read-only hosting: the one shape in which exposing the browser UI is safe.
 *
 * AI Forge still has no per-user authentication, so a hosted instance cannot
 * tell one visitor from another. What it CAN do is make that irrelevant, by
 * serving nothing but reads. Under this mode:
 *
 *   - the server token is never injected into the HTML shell (see pageHtml in
 *     server.mjs), so no visitor ever holds the credential for a mutating route;
 *   - every non-GET/HEAD request is refused outright, token or not, so even a
 *     leaked credential cannot install a plugin -- which is code execution on
 *     the server, and the reason the blanket refusal existed in the first place.
 *
 * Managing a hosted instance is therefore an operator job over SSH against the
 * loopback listener, not something done through the public address.
 *
 * Deliberately requires THREE independent signals. UWP_FORGE_TOKEN and
 * UWP_ALLOWED_HOSTS together are NOT enough, and a test pins that: both get set
 * by anyone wiring up a deployment, without that person having decided the
 * instance should face the public. UWP_PUBLIC_READONLY=1 is that decision,
 * stated once, in a name that says what it costs.
 */
export function isHostedReadOnly() {
  if ((process.env.UWP_PUBLIC_READONLY || '').trim() !== '1') return false;
  if (!(process.env.UWP_FORGE_TOKEN || '').trim()) return false;
  return parseAllowedHosts().length > 0;
}

/** Refuse to expose the browser UI until it has real hosted-user authentication. */
export function assertPublicBindSafe(listen) {
  if (!isPublicBind(listen.host)) return;
  if (isHostedReadOnly()) return;
  throw new Error(
    'uwp: public browser hosting is not supported. Keep UWP_BIND on loopback; ' +
    'a hosted deployment requires user authentication that AI Forge does not yet provide. ' +
    'For a read-only public instance set UWP_PUBLIC_READONLY=1 together with ' +
    'UWP_FORGE_TOKEN and UWP_ALLOWED_HOSTS; mutating routes are then refused outright.',
  );
}
