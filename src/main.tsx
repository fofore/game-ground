import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource/jua/400.css';
import '@fontsource/ibm-plex-sans-kr/400.css';
import '@fontsource/ibm-plex-sans-kr/500.css';
import '@fontsource/ibm-plex-sans-kr/700.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
