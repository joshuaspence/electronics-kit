import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import { App } from './ui/App';
import { RotatePrompt } from './ui/ScreenNotes';
import './ui/app.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <RotatePrompt />
    <App />
  </StrictMode>,
);
