import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// PWA Service Worker Registration with auto-update
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version available.');
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use.');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
