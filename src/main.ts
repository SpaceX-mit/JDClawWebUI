// JDClaw WebUI - Main Entry Point
import './styles.css';
import './components/jd-app.js';
import './components/jd-toast.js';
import './components/jd-confirm-dialog.js';
import './components/jd-context-menu.js';

// Remove initial loader immediately
const initialLoader = document.getElementById('initial-loader');
if (initialLoader) {
  initialLoader.remove();
}

console.log('[JDClaw] Application starting...');

// Create app element
const app = document.createElement('jd-app');
document.body.appendChild(app);
