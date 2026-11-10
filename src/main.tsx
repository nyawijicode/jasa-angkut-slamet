import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Ekspos React ke global agar terdeteksi oleh Wappalyzer/tech profiler
if (typeof window !== 'undefined') {
  (window as unknown as { React?: unknown }).React = React
}
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/refresh.css'
import './styles/design.css'

// Register Service Worker for PWA installability & offline caching
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Jasa Angkut Slamet PWA content updated.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('PWA Service Worker registration:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
