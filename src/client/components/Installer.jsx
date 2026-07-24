// First-run install wizard (blocking, 2 steps). Shown until /api/installed is set.
import { useState } from 'react';
import { fetchJSON } from '../core.jsx';
import { currentBrowser, BROWSER_NAMES } from '../browser.js';
import { LOGO_FULL } from '../brand.js';
import { Button, TextInput, TextArea } from '../ui';

export default function Installer({ status, onDone }) {
  const [step, setStep] = useState(1);
  const [gh, setGh] = useState('');
  const [cookie, setCookie] = useState('');
  const [ghMsg, setGhMsg] = useState({ text: '', kind: '' });
  const [ckMsg, setCkMsg] = useState({ text: '', kind: '' });
  const [escape, setEscape] = useState(false);

  const ghDetected = !!(status && status.github && status.github.set);
  const browser = currentBrowser();

  function finish() {
    fetch('/api/installed', { method: 'POST' }).then(() => onDone());
  }

  function primary() {
    if (step === 1) {
      const t = gh.trim();
      if (t) {
        setGhMsg({ text: 'saving…', kind: '' });
        fetchJSON('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) })
          .then(({ data }) => {
            if (data && data.error) setGhMsg({ text: data.error, kind: 'bad' });
            else { setGh(''); setStep(2); }
          });
      } else { setStep(2); }
      return;
    }
    const c = cookie.trim();
    if (!c) { setCkMsg({ text: 'Paste your cookie to finish - or continue anyway below.', kind: 'bad' }); setEscape(true); return; }
    setCkMsg({ text: 'saving and testing…', kind: '' });
    fetchJSON('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: c }) })
      .then(({ ok, data }) => {
        if (!ok) { setCkMsg({ text: data.error || 'could not save', kind: 'bad' }); setEscape(true); return; }
        return fetchJSON('/api/cookie/test', { method: 'POST' }).then(({ data: d }) => {
          if (d.ok) finish();
          else { setCkMsg({ text: d.message || 'Trac could not validate the cookie.', kind: 'bad' }); setEscape(true); }
        });
      });
  }

  function importCookie() {
    setCkMsg({ text: 'Importing from ' + browser + '… (approve any Keychain prompt)', kind: '' });
    fetchJSON('/api/cookie/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ browser }) })
      .then(({ data }) => {
        if (data.saved) finish();
        else { setCkMsg({ text: data.message, kind: 'bad' }); setEscape(true); }
      })
      .catch(() => { setCkMsg({ text: 'Import failed.', kind: 'bad' }); setEscape(true); });
  }

  return (
    <div className="installer">
      <div className="inst-card">
        <div className="inst-head">
          <span className="logo" aria-label="UnleashWP" dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
          <div className="inst-dots">
            <span className={'dot' + (step >= 1 ? ' active' : '')} />
            <span className={'dot' + (step >= 2 ? ' active' : '')} />
          </div>
        </div>
        <div className="inst-body">
          {step === 1 && (
            <div className="inst-step">
              <span className="inst-kicker">Step 1 of 2</span>
              <h2>Connect GitHub</h2>
              <p>Raises your API limit from 60 to 5000 requests an hour. Works with <b>any</b> GitHub account - no access to the WordPress org, no token scopes. It only reads public repos.</p>
              {ghDetected ? (
                <div className="inst-ok"><span>✓</span> GitHub ready - {status.github.source === 'gh' ? 'detected from the gh CLI' : 'saved token'} · 5000/h</div>
              ) : (
                <div>
                  <ol><li>Detected automatically if the <code>gh</code> CLI is logged in, or <a href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener">create a token</a> (leave every scope unchecked) and paste it:</li></ol>
                  <form onSubmit={(e) => e.preventDefault()} autoComplete="off" style={{ margin: 0 }}>
                    <TextInput type="password" value={gh} onChange={(e) => setGh(e.target.value)} placeholder="ghp_… or github_pat_…  (optional - skip for 60/h)" autoComplete="off" spellCheck="false" />
                  </form>
                  <span className={'msg' + (ghMsg.kind ? ' ' + ghMsg.kind : '')}>{ghMsg.text}</span>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="inst-step">
              <span className="inst-kicker">Step 2 of 2</span>
              <h2>Connect WordPress.org</h2>
              <p>Needed for <b>deep</b> - full Trac ticket descriptions. Paste your session cookie once; it is stored locally (owner-only) and sent only to WordPress.org.</p>
              {browser && (
                <div className="quickimport">
                  <span className="qi-label">Quick import from your browser <span className="qi-note">(you must be logged in there)</span></span>
                  <div className="qi-btns"><Button variant="ghost" size="sm" onClick={importCookie}>Import from {BROWSER_NAMES[browser]}</Button></div>
                </div>
              )}
              <details className="qi-manual"><summary>Or paste it manually</summary>
                <ol>
                  <li><a href="https://wordpress.org/" target="_blank" rel="noopener">Log in to wordpress.org</a>.</li>
                  <li>DevTools → Application → Cookies → <code>wordpress.org</code> → copy <code>wporg_logged_in</code> + <code>wporg_sec</code> as <code>name=value; name=value</code>.</li>
                </ol>
                <TextArea rows="3" value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="wporg_logged_in=…; wporg_sec=…" />
              </details>
              <span className={'msg' + (ckMsg.kind ? ' ' + ckMsg.kind : '')}>{ckMsg.text}</span>
              {escape && (
                <div className="inst-escape">Trac isn't reachable right now (bot wall or expired cookie). You can <button className="back" type="button" onClick={finish}>continue anyway</button> - the tool runs cookie-free and you can add the cookie later in Setup.</div>
              )}
            </div>
          )}
        </div>
        <div className="inst-foot">
          {step !== 1 && <button className="back" type="button" onClick={() => setStep(1)}>Back</button>}
          <Button variant="primary" onClick={primary}>{step === 1 ? 'Continue' : 'Finish setup'}</Button>
        </div>
      </div>
    </div>
  );
}
