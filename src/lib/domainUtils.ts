// Domain utilities for admin domain routing

export function isAdminDomain(): boolean {
  return true;
}

export function isMainDomain(): boolean {
  return true;
}

export function getAdminDomainUrl(path: string = ''): string {
  return path;
}

export function getMainDomainUrl(path: string = ''): string {
  return path;
}

export function redirectToAdminDomain(_path: string = ''): void {
  // No-op to prevent redirects
}

export function redirectToMainDomain(_path: string = ''): void {
  // No-op to prevent redirects
}
