/**
 * Auth Helpers - Centralized authentication utilities
 */

export function getRedirectUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return '/auth/callback';
}

export function getSiteUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function checkBiometricSupport(): Promise<{
  available: boolean;
  message: string;
}> {
  if (!window.PublicKeyCredential) {
    return {
      available: false,
      message: 'Your browser does not support biometric authentication',
    };
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      return {
        available: false,
        message: 'No biometric authenticator found on this device',
      };
    }
    return {
      available: true,
      message: 'Biometric authentication is available',
    };
  } catch {
    return {
      available: false,
      message: 'Error checking biometric support',
    };
  }
}
