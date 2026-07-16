import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

// Explicit null check rather than a `!` assertion: strict mode types
// getElementById as possibly-null, and handling it turns a cryptic runtime error
// into a named one.
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
