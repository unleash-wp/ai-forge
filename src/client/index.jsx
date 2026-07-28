// Browser UI entry: mount the React shell. The core CLI never loads this - it is
// bundled by webpack into dist/main.js and served from /assets/.
import { createRoot } from 'react-dom/client';
import { Provider } from './ui/Provider.jsx';
import { ToastProvider } from './core.jsx';
import { I18nProvider } from './i18n.jsx';
import App from './App.jsx';

// Smoothly cross-fade colours on a light/dark switch. Scoped to a class that the
// theme toggle adds only for the duration of the switch, so it never slows hovers
// or normal interaction.
const themeAnim = document.createElement('style');
themeAnim.textContent = '.theme-anim, .theme-anim *, .theme-anim *::before, .theme-anim *::after { transition: background-color .28s ease, border-color .28s ease, color .28s ease, fill .28s ease !important; }';
document.head.appendChild(themeAnim);

createRoot(document.getElementById('root')).render(
  <Provider><I18nProvider><ToastProvider><App /></ToastProvider></I18nProvider></Provider>
);
