// Core services shared by the shell and every tool plugin: a fetch helper, the
// toast, and the CoreContext a plugin component receives to talk to the shell.
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Box } from '@chakra-ui/react';

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
      <Box position="fixed" bottom="6" left="50%" zIndex="300" bg="navy" color="white"
        px="4.5" py="2.5" borderRadius="lg" boxShadow="lg" fontWeight="600" fontSize="0.8438rem"
        pointerEvents="none" transition="opacity .2s ease, transform .2s ease"
        opacity={msg ? 1 : 0} transform={msg ? 'translate(-50%, 0)' : 'translate(-50%, 1rem)'}
        role="status" aria-live="polite">{msg ? '✓ ' + msg : ''}</Box>
    </ToastCtx.Provider>
  );
}

// ---- CoreContext: the API a tool plugin gets from the shell ----
// { toast, openSetup, status, refreshStatus }. Kept intentionally small so the
// plugin contract stays stable as the shell grows.
export const CoreContext = createContext(null);
export function useCore() { return useContext(CoreContext); }
