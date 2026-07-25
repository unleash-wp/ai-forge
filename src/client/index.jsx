// Browser UI entry: mount the React shell. The core CLI never loads this - it is
// bundled by webpack into dist/main.js and served from /assets/.
import { createRoot } from 'react-dom/client';
import { Provider } from './ui/Provider.jsx';
import { ToastProvider } from './core.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <Provider><ToastProvider><App /></ToastProvider></Provider>
);
