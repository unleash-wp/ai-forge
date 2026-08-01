// Core services shared by the shell and every tool plugin: a fetch helper, the
// toast, and the CoreContext a plugin component receives to talk to the shell.
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Box, Portal } from '@chakra-ui/react';

// ---- One injectable transport for every Forge /api call ----
// The browser talks to a same-origin server; the MCP-app iframe has no origin and
// routes /api through the forge_api tool; a future native (Tauri) shell talks to a
// loopback URL. Instead of each surface inventing its own transport, they all go
// through apiFetch(). Each surface sets exactly one value: apiBase (default '' =
// same-origin; Tauri sets a loopback origin). The iframe keeps working unchanged
// because apiFetch calls the global fetch, which its bridge patches.
let apiBase = '';
export function setApiBase(base) { apiBase = base || ''; }

function forgeAuthHeaders() {
  const t = typeof window !== 'undefined' && window.__FORGE_TOKEN__;
  return t ? { 'X-Forge-Token': t } : {};
}

// fetch a Forge path. Absolute URLs (external APIs) pass through untouched; a
// relative /api path is resolved against apiBase.
export function apiFetch(path, opts = {}) {
  const url = /^https?:\/\//.test(path) ? path : apiBase + path;
  const headers = { ...forgeAuthHeaders(), ...(opts.headers || {}) };
  return fetch(url, { ...opts, headers });
}

// apiFetch + parse JSON, returning { ok, data } so callers branch on HTTP status.
export function fetchJSON(path, opts) {
  return apiFetch(path, opts).then((r) => r.json().then((data) => ({ ok: r.ok, data })));
}

// Look up one connector descriptor from /api/config/status by id (or null).
export function connector(status, id) {
  return ((status && status.connectors) || []).find((c) => c.id === id) || null;
}
// Its credential status object (set / source / …), with a not-connected default.
export function connectorStatus(status, id) {
  const c = connector(status, id);
  return (c && c.status) || { set: false };
}

// ---- Toast (confirmation after any copy / download) ----
const ToastCtx = createContext(() => {});
export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }) {
  const [toastState, setToastState] = useState({ msg: '', kind: '' });
  const timer = useRef(null);
  // toast(message) is neutral (navy); toast(message, 'success') is green.
  const toast = useCallback((m, kind = '') => {
    setToastState({ msg: m, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastState((s) => ({ ...s, msg: '' })), 1800);
  }, []);
  const { msg, kind } = toastState;
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <Portal>
        <Box position="fixed" bottom="6" left="50%" zIndex="2147483647" bg={kind === 'success' ? 'ui.good' : 'navy'} color="white"
          px="4.5" py="2.5" borderRadius="lg" boxShadow="lg" fontWeight="600" fontSize="0.8438rem"
          pointerEvents="none" transition="opacity .2s ease, transform .2s ease"
          opacity={msg ? 1 : 0} transform={msg ? 'translate(-50%, 0)' : 'translate(-50%, 1rem)'}
          role="status" aria-live="polite">{msg ? '✓ ' + msg : ''}</Box>
      </Portal>
    </ToastCtx.Provider>
  );
}

// ---- CoreContext: the API a tool plugin gets from the shell ----
// { toast, openSetup, status, refreshStatus }. Kept intentionally small so the
// plugin contract stays stable as the shell grows.
export const CoreContext = createContext(null);
export function useCore() { return useContext(CoreContext); }
