// Site URL utility - deprecated, use SITE_URL from env.ts instead

import { SITE_URL } from './env';

/** @deprecated Use SITE_URL from env.ts instead */
export function getSiteUrl(): string {
  return SITE_URL;
}

/** @deprecated Use SITE_URL from env.ts instead */
export function getSiteUrlSafe(): string {
  return SITE_URL;
}
