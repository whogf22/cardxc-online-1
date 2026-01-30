import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { logEnvironmentValidation, validateEnvironment } from './lib/envValidation';
import { initSentry } from './lib/sentry';
import { initWebVitals } from './lib/webVitals';
import { escapeHTML } from './lib/inputSanitizer';

// CRITICAL FIX: Add global error handlers BEFORE anything else to catch module-level errors
if (typeof window !== 'undefined') {
  // Global error handler for uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('❌ [GLOBAL ERROR]', event.error || event.message, event);
    
    // Show user-friendly error if not already handled
    const rootElement = document.getElementById('root');
    if (rootElement && !rootElement.querySelector('[data-error-displayed]')) {
      rootElement.setAttribute('data-error-displayed', 'true');
      const existingError = rootElement.querySelector('.startup-error');
      if (!existingError) {
        // SECURITY FIX: Escape error message to prevent XSS
        const safeMessage = escapeHTML(event.message || 'Please check the browser console for details.');
        
        // Use document.createElement and textContent for safety
        const errorContainer = document.createElement('div');
        errorContainer.className = 'startup-error';
        Object.assign(errorContainer.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f3f4f6',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem'
        });

        const card = document.createElement('div');
        Object.assign(card.style, {
          maxWidth: '600px',
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        });

        const title = document.createElement('h1');
        title.style.color = '#dc2626';
        title.style.marginBottom = '1rem';
        title.textContent = '⚠️ Application Error';

        const p1 = document.createElement('p');
        p1.style.color = '#374151';
        p1.style.marginBottom = '1.5rem';
        p1.textContent = 'An unexpected error occurred while loading the application.';

        const p2 = document.createElement('p');
        p2.style.color = '#6b7280';
        p2.style.fontSize = '0.875rem';
        p2.style.marginBottom = '1.5rem';
        p2.textContent = safeMessage;

        const button = document.createElement('button');
        button.onclick = () => window.location.reload();
        Object.assign(button.style, {
          padding: '0.75rem 1.5rem',
          background: '#059669',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '600'
        });
        button.textContent = 'Reload Page';

        card.appendChild(title);
        card.appendChild(p1);
        card.appendChild(p2);
        card.appendChild(button);
        errorContainer.appendChild(card);
        rootElement.appendChild(errorContainer);
      }
    }
  });

  // Global handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ [UNHANDLED PROMISE REJECTION]', event.reason);
    event.preventDefault(); // Prevent default browser error handling
  });
}

// Initialize Sentry (only in production) - wrapped in try-catch
try {
  initSentry();
} catch (error) {
  console.error('❌ [Sentry] Initialization failed:', error);
}

// Initialize Web Vitals tracking (only in production) - wrapped in try-catch
try {
  initWebVitals();
} catch (error) {
  console.error('❌ [Web Vitals] Initialization failed:', error);
}

// Validate environment variables on startup
logEnvironmentValidation();

// Check for critical missing variables and show user-friendly error
const envCheck = validateEnvironment();

// Helper function to show error UI
function showErrorUI(message: string, missingVars: string[] = []) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'startup-error';
    Object.assign(errorContainer.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '600px',
      padding: '2rem',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    });

    const title = document.createElement('h1');
    title.style.color = '#dc2626';
    title.style.marginBottom = '1rem';
    title.textContent = missingVars.length > 0 ? '⚠️ Configuration Error' : '⚠️ Application Error';

    const p = document.createElement('p');
    p.style.color = '#374151';
    p.style.marginBottom = '1.5rem';
    p.textContent = message;

    card.appendChild(title);
    card.appendChild(p);

    if (missingVars.length > 0) {
      const varsContainer = document.createElement('div');
      Object.assign(varsContainer.style, {
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '4px',
        padding: '1rem',
        marginBottom: '1rem'
      });

      const varsTitle = document.createElement('p');
      Object.assign(varsTitle.style, {
        color: '#991b1b',
        fontWeight: '600',
        marginBottom: '0.5rem'
      });
      varsTitle.textContent = 'Missing variables:';

      const ul = document.createElement('ul');
      Object.assign(ul.style, {
        color: '#991b1b',
        margin: '0',
        paddingLeft: '1.5rem'
      });

      missingVars.forEach(v => {
        const li = document.createElement('li');
        li.textContent = v;
        ul.appendChild(li);
      });

      varsContainer.appendChild(varsTitle);
      varsContainer.appendChild(ul);
      card.appendChild(varsContainer);
    }

    const helpP = document.createElement('p');
    Object.assign(helpP.style, {
      color: '#6b7280',
      fontSize: '0.875rem',
      marginBottom: '1.5rem'
    });
    helpP.innerHTML = 'Please check your <code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px;">.env</code> file and ensure all required variables are set. See <code style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px;">.env.example</code> for reference.';
    
    const button = document.createElement('button');
    button.onclick = () => window.location.reload();
    Object.assign(button.style, {
      padding: '0.75rem 1.5rem',
      background: '#059669',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600'
    });
    button.textContent = 'Reload Page';

    card.appendChild(helpP);
    card.appendChild(button);
    errorContainer.appendChild(card);
    
    // Clear and append
    rootElement.innerHTML = '';
    rootElement.appendChild(errorContainer);
  }
}

// Check if environment is invalid - show error immediately
if (!envCheck.isValid) {
  console.error('❌ [STARTUP] Critical environment variables missing!');
  showErrorUI(
    'The application is missing required environment variables. Please check your configuration.',
    envCheck.missing || []
  );
} else {
  // Environment is valid, proceed with App import
  // CRITICAL FIX: Use dynamic import with Promise to catch module load errors
  import('./App').then((AppModule) => {
    const App = AppModule.default;
    
    // Environment is valid and App loaded, proceed with app initialization
    try {
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    } catch (error) {
      console.error('❌ [STARTUP] Failed to render App:', error);
      showErrorUI('Failed to initialize the application. Please check the browser console for details.');
    }
  }).catch((error) => {
    console.error('❌ [STARTUP] Failed to load App module:', error);
    showErrorUI('Failed to load the application. Please check the browser console for details.');
  });
}
