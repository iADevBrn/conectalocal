import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './responsive.css';
import App from './App.jsx';

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      const appRegistrations = registrations.filter((registration) =>
        [registration.active, registration.waiting, registration.installing].some(
          (worker) => worker?.scriptURL === `${location.origin}/sw.js`
        )
      );
      return Promise.all(appRegistrations.map((registration) => registration.unregister()))
        .then((removed) => {
          if (removed.some(Boolean)) location.reload();
        });
    }).catch((err) => console.error('Failed to unregister the development service worker:', err));
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('SW registered:', reg.scope);
        setInterval(() => reg.update(), 60 * 60 * 1000);
      }).catch((err) => console.warn('SW registration failed:', err));
    });
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);