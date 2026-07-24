// Core services shared by the shell and every tool plugin: a fetch helper, the
// toast, and the CoreContext a plugin component receives to talk to the shell.
import { createContext, useContext, useState, useCallback, useRef } from 'react';

// fetch + parse JSON, returning { ok, data } so callers branch on HTTP status.
export function fetchJSON(url, opts) {
  return fetch(url, opts).then((r) => r.json().then((data) => ({ ok: r.ok, data })));
}

// ---- Toast (confirmation after any copy / download) ----
const ToastCtx = createContext(() => {});
export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const timer = useRef(null);
  const toast = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 1800);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={'toast' + (msg ? ' show' : '')} role="status" aria-live="polite">{msg ? '✓ ' + msg : ''}</div>
    </ToastCtx.Provider>
  );
}

// ---- CoreContext: the API a tool plugin gets from the shell ----
// { toast, openSetup, status, refreshStatus }. Kept intentionally small so the
// plugin contract stays stable as the shell grows.
export const CoreContext = createContext(null);
export function useCore() { return useContext(CoreContext); }
