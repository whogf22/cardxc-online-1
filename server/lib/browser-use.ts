import { BrowserUse } from "browser-use-sdk/v3";

// Server-only — no VITE_ prefix, never bundled into the browser
const apiKey = process.env.BROWSER_USE_API_KEY ?? "";
export const client = new BrowserUse({ apiKey });
