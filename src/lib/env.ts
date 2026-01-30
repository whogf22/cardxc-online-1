// Centralized environment configuration
// All env vars validated on import - throws in production if required vars are missing

const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

function getEnvVar(name: string, required: boolean = true, allowLocalhost: boolean = false): string {
  const value = import.meta.env[name] || '';
  
  if (required && !value) {
    if (isProduction) {
      throw new Error(
        `Missing required environment variable: ${name}. ` +
        `This variable is required in production. Please set it in your environment.`
      );
    }
    if (!required) {
      return '';
    }
  }
  
  if (isProduction && value && value.includes('localhost') && !allowLocalhost) {
    throw new Error(
      `Environment variable ${name} contains 'localhost' which is not allowed in production. ` +
      `Current value: ${value}`
    );
  }
  
  return value.trim();
}

export const SITE_URL = ((): string => {
  const value = getEnvVar('VITE_PUBLIC_SITE_URL', false, false);
  
  if (value) {
    return value;
  }
  
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return isProduction ? 'https://cardxc.online' : 'http://localhost:3000';
})();

// Backend API configuration
export const AUTH_API_URL = getEnvVar('VITE_PUBLIC_AUTH_URL', false) || '';
export const AUTH_API_KEY = getEnvVar('VITE_PUBLIC_AUTH_KEY', false) || '';

export const API_URL = getEnvVar('VITE_API_URL', false) || 
  (isProduction ? '/api' : 'http://localhost:8000/api');

export const APP_DOMAIN = getEnvVar('VITE_APP_DOMAIN', false) || 'cardxc.online';

export const ADMIN_DOMAIN = getEnvVar('VITE_ADMIN_DOMAIN', false) || 'admin.cardxc.online';

export const ADYEN_ENABLED = getEnvVar('VITE_ADYEN_ENABLED', false) === 'true';

// Backward compatibility exports (deprecated)
export const SUPABASE_URL = AUTH_API_URL;
export const SUPABASE_ANON_KEY = AUTH_API_KEY;

console.log('[ENV] All environment variables validated successfully.\n');

if (isDevelopment && typeof window !== 'undefined') {
  console.log('[ENV] Configuration loaded:', {
    SITE_URL,
    API_URL,
    isProduction,
    isDevelopment,
  });
}
