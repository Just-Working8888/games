import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTelegram } from '@games/shell';
import '@games/shell/styles.css';
import { App } from './App';

initTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
