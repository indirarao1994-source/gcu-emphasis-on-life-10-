import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Globally patch localStorage to prevent QuotaExceededError crashes
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key, value) {
  try {
    originalSetItem.apply(this, [key, value]);
  } catch (error) {
    console.warn(`localStorage quota exceeded for key: ${key}. Safely ignoring.`);
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
