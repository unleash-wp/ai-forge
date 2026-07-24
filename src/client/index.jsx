// Browser UI entry: mount the React shell. The core CLI never loads this - it is
// bundled by webpack into dist/main.js and served from /assets/.
import '../styles/main.scss';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './core.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <ToastProvider><App /></ToastProvider>
);
