// Setup panel: wires up the two shared credentials (GitHub token + wordpress.org
// cookie). Both are the user's own, stored locally (owner-only), sent only to
// GitHub / WordPress.org. Rendered as a card in <main>, toggled open by the shell.
import { useState } from 'react';
import { fetchJSON } from './core.jsx';
import { currentBrowser, BROWSER_NAMES } from './browser.js';
import { Button, TextInput, TextArea } from './ui';

export default function SetupWizard({ status, refreshStatus, open, onClose }) {
  const [ghToken, setGhToken] = useState('');
  const [cookieVal, setCookieVal] = useState('');
  const [ghMsg, setGhMsg] = useState({ text: '', kind: '' });
  const [ckMsg, setCkMsg] = useState({ text: '', kind: '' });
  const [editGh, setEditGh] = useState(false);
  const [editTrac, setEditTrac] = useState(false);

  const gh = status ? status.github : { set: false };
  const trac = status ? status.trac : { set: false };
  const browser = currentBrowser();

  function saveGh() {
    const token = ghToken.trim();
    if (!token) { setGhMsg({ text: 'paste the token first', kind: 'bad' }); return; }
    setGhMsg({ text: 'saving…', kind: '' });
    fetchJSON('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(({ ok, data }) => { if (ok) { setGhToken(''); testGh(); } else setGhMsg({ text: data.error, kind: 'bad' }); });
  }
  function testGh() {
    setGhMsg({ text: 'testing…', kind: '' });
    fetchJSON('/api/github-token/test', { method: 'POST' }).then(({ data }) => {
      setGhMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); setEditGh(false); refreshStatus();
    });
  }
  function disconnectGh() {
    fetchJSON('/api/github-token', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) setGhMsg({ text: data.error, kind: 'bad' }); else { setGhToken(''); refreshStatus(); }
    });
  }
  function saveCookie() {
    const c = cookieVal.trim();
    if (!c) { setCkMsg({ text: 'paste the cookie first', kind: 'bad' }); return; }
    setCkMsg({ text: 'saving…', kind: '' });
    fetchJSON('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: c }) })
      .then(({ ok, data }) => { if (ok) { setCookieVal(''); testCookie(); } else setCkMsg({ text: data.error, kind: 'bad' }); });
  }
  function testCookie() {
    setCkMsg({ text: 'testing…', kind: '' });
    fetchJSON('/api/cookie/test', { method: 'POST' }).then(({ data }) => {
      setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); setEditTrac(false); refreshStatus();
    });
  }
  function disconnectCookie() {
    fetchJSON('/api/cookie', { method: 'DELETE' }).then(({ data }) => {
      if (data && data.error) setCkMsg({ text: data.error, kind: 'bad' }); else { setCookieVal(''); refreshStatus(); }
    });
  }
  function importCookie() {
    setCkMsg({ text: 'Importing from ' + browser + '… (approve any Keychain prompt)', kind: '' });
    fetchJSON('/api/cookie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browser }) })
      .then(({ data }) => { setCkMsg({ text: data.message, kind: data.ok ? 'good' : 'bad' }); refreshStatus(); })
      .catch(() => setCkMsg({ text: 'Import failed.', kind: 'bad' }));
  }

  const ghSrc = gh.source === 'gh' ? 'GitHub CLI (gh)' : (gh.source === 'env' ? 'GITHUB_TOKEN env' : 'saved token');
  const showGhSetup = !gh.set || editGh;
  const showTracSetup = !trac.set || editTrac;

  return (
    <section className={'card wizard' + (open ? ' open' : '')}>
      <button className="wiz-close" type="button" onClick={onClose} aria-label="Close setup">&times;</button>
      <h2>Setup</h2>
      <p className="lead">Two keys, both stored locally (owner-only file) and sent only to GitHub / WordPress.org. Each is your own - nothing is shared. The same keys power <code>uwp --deep</code> on the CLI.</p>
      <div className="steps">
        <div className={'step' + (gh.set ? ' done' : '')}>
          <div className="num"><span className="d">1</span></div>
          <div>
            <h3>GitHub <em>lifts the API limit from 60 to 5000 requests an hour</em></h3>
            {gh.set && (
              <div className="connected"><span>✓</span> Connected · {ghSrc} · 5000/h
                {gh.source === 'file'
                  ? <button className="disc-btn" type="button" onClick={disconnectGh}>Disconnect</button>
                  : <span className="disc-note">{gh.source === 'gh' ? 'auto-detected from the gh CLI' : 'set by env var'}</span>}
              </div>
            )}
            {showGhSetup && (
              <div>
                <p>Works with <b>any</b> GitHub account. You do <b>not</b> need access to the WordPress org, and the token needs <b>no scopes</b> - it only reads public repos and raises your rate limit. Skip it and the tool still runs at 60 requests an hour.</p>
                <ol><li>One click if the <code>gh</code> CLI is logged in (detected automatically), or <a href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener">create a token</a> (leave every scope unchecked) and paste it below.</li></ol>
                <form onSubmit={(e) => e.preventDefault()} autoComplete="off" style={{ margin: 0 }}>
                  <TextInput type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} onPaste={() => setTimeout(saveGh, 30)} placeholder="ghp_… or github_pat_…" autoComplete="off" spellCheck="false" />
                </form>
                <div className="rowbtns">
                  <Button variant="primary" size="sm" onClick={saveGh}>Save &amp; connect</Button>
                  <Button variant="ghost" size="sm" onClick={testGh}>Test</Button>
                  <span className={'msg' + (ghMsg.kind ? ' ' + ghMsg.kind : '')}>{ghMsg.text}</span>
                </div>
              </div>
            )}
            {gh.set && gh.source !== 'env' && !editGh && (
              <button className="expander" onClick={() => setEditGh(true)}>{gh.source === 'gh' ? 'Use your own token instead' : 'Use a different token'}</button>
            )}
          </div>
        </div>
        <div className={'step' + (trac.set ? ' done' : '')}>
          <div className="num"><span className="d">2</span></div>
          <div>
            <h3>WordPress.org <em>only needed for “deep” (full ticket descriptions)</em></h3>
            {trac.set && (
              <div className="connected"><span>✓</span> Cookie saved · {trac.source}
                {trac.source === 'file'
                  ? <button className="disc-btn" type="button" onClick={disconnectCookie}>Disconnect</button>
                  : <span className="disc-note">set by env var</span>}
              </div>
            )}
            {showTracSetup && (
              <div>
                <p>A web page can't read this cookie for you (it's HttpOnly). Quickest is to import it straight from the browser you're logged into:</p>
                {browser && (
                  <div className="quickimport">
                    <span className="qi-label">Quick import <span className="qi-note">(macOS)</span></span>
                    <div className="qi-btns"><Button variant="ghost" size="sm" onClick={importCookie}>Import from {BROWSER_NAMES[browser]}</Button></div>
                  </div>
                )}
                <details className="qi-manual"><summary>Or paste it manually</summary>
                  <ol>
                    <li><a href="https://wordpress.org/" target="_blank" rel="noopener">Log in to wordpress.org</a>.</li>
                    <li>DevTools → Application → Cookies → <code>wordpress.org</code> → copy <code>wporg_logged_in</code> + <code>wporg_sec</code> as <code>name=value; name=value</code>.</li>
                  </ol>
                  <TextArea rows="3" value={cookieVal} onChange={(e) => setCookieVal(e.target.value)} onPaste={() => setTimeout(saveCookie, 30)} placeholder="wporg_logged_in=…; wporg_sec=…" />
                </details>
                <div className="rowbtns">
                  <Button variant="primary" size="sm" onClick={saveCookie}>Save &amp; connect</Button>
                  <Button variant="ghost" size="sm" onClick={testCookie}>Test</Button>
                  <span className={'msg' + (ckMsg.kind ? ' ' + ckMsg.kind : '')}>{ckMsg.text}</span>
                </div>
              </div>
            )}
            {trac.set && trac.source === 'file' && !editTrac && (
              <button className="expander" onClick={() => setEditTrac(true)}>Replace the cookie</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
