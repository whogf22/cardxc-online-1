// Environment variable validation
// Validates required env vars on app startup and shows clear error messages

interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [] as const;

const RECOMMENDED_ENV_VARS = [
  'VITE_APP_DOMAIN',
  'VITE_ADMIN_DOMAIN',
] as const;

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  }

  for (const varName of RECOMMENDED_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || value.trim() === '') {
      warnings.push(varName);
    }
  }


  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

export function logEnvironmentValidation(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    console.error('[ENV] Missing required environment variables:');
    result.missing.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('   See .env.example for reference.\n');
  }

  if (result.warnings.length > 0) {
    console.warn('[ENV] Missing recommended environment variables:');
    result.warnings.forEach((varName) => {
      console.warn(`   - ${varName}`);
    });
    console.warn('   App will use fallback values, but some features may not work correctly.\n');
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log('[ENV] All environment variables validated successfully.\n');
  }
}

export function getEnvVar(name: string, fallback: string = ''): string {
  return import.meta.env[name] || fallback;
}

export function isProduction(): boolean {
  return import.meta.env.PROD === true;
}

export function isDevelopment(): boolean {
  return import.meta.env.DEV === true;
}
