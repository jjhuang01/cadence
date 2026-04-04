import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// Remove the static pre-splash; React's SplashScreen takes over immediately
document.getElementById('pre-splash')?.remove();
