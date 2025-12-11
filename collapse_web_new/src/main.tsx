import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/variables.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Avoid service worker interference during development; only register in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swPath).catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}

// Debug: add 'debug-overflow' class to documentElement when ?debug=overflow is present
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === 'overflow') {
      document.documentElement.classList.add('debug-overflow')
    }
  } catch (e) {
    // ignore
  }
}
