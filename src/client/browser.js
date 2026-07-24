// Detect the browser this page runs in - the cookie quick-import only makes sense
// for the browser the user is actually logged into wordpress.org with.
export function currentBrowser() {
  const ua = navigator.userAgent;
  if (ua.indexOf('Edg/') !== -1) return 'edge';
  if (ua.indexOf('Firefox/') !== -1) return 'firefox';
  if (ua.indexOf('Chrome/') !== -1 && ua.indexOf('OPR/') === -1) return 'chrome';
  if (ua.indexOf('Safari/') !== -1) return 'safari';
  return null;
}

export const BROWSER_NAMES = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari' };
