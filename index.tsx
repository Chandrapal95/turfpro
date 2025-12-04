import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("CRITICAL ERROR: Could not find root element to mount to. Check index.html");
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  console.error("Failed to mount React application:", e);
  rootElement.innerHTML = '<div style="color:red; padding:20px; text-align:center;"><h1>Application Failed to Load</h1><p>Check console for errors.</p></div>';
}