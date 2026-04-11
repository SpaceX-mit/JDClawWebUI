// JDClaw WebUI - Main Entry Point
import './styles.css';
import './components/jd-app.js';

// Remove initial loader immediately when app starts
const initialLoader = document.getElementById('initial-loader');
if (initialLoader) {
  initialLoader.remove();
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  console.log('[JDClaw] Application starting...');
  
  // Create app element if it doesn't exist
  let app = document.querySelector('jd-app');
  if (!app) {
    app = document.createElement('jd-app');
    document.body.appendChild(app);
  }
});
