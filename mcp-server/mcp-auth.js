/**
 * MCP token minting and verification.
 *
 * Kept in its own module (rather than inline in `http-server.js`) because
 * `http-server.js` binds a port and opens a DB pool at import time, which makes
 * it untestable. These primitives are pure and are covered by
 * `server/lib/__tests__/mcpAuth.test.ts`.
 *
 * SECURITY — this module is the fix for the "any CardXC user token authenticates
 * to MCP" defect. Two rules are load-bearing and must not be relaxed:
 *
 *  1. The signing secret is `MCP_SECRET` and ONLY `MCP_SECRET`. It previously
 *     fell back to `SESSION_SECRET`, the key the main app uses for end-user
 *     `auth_token` cookies — which meant an ordinary user's login token carried
 *     a valid signature here. A secret that merely duplicates SESSION_SECRET is
 *     rejected for the same reason.
 *
 *  2. Verification pins the algorithm and asserts `iss`/`aud`. The server always
 *     minted these claims, but the old `jwt.verify(token, secret)` call never
 *     checked them, so any correctly-signed token of any shape was accepted.
 */
import jwt from "jsonwebtoken";

export const MCP_ISSUER = "cardxc-mcp";
export const MCP_AUDIENCE = "cardxc-mcp-client";
export const MCP_TOKEN_TTL = "8h";

const MIN_SECRET_LENGTH = 32;

/**
 * Resolve the MCP signing secret from an env-like object.
 * Throws (fail closed) rather than returning a weak or shared value.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolveMcpSecret(env) {
    const secret = env.MCP_SECRET;

    if (!secret) {
        throw new Error(
            "FATAL: MCP_SECRET must be set — the MCP server refuses to start without its own signing secret. " +
                "It must NOT be shared with SESSION_SECRET: that would let any end-user auth_token authenticate as an MCP client.",
        );
    }

    if (secret.length < MIN_SECRET_LENGTH) {
        throw new Error(
            `FATAL: MCP_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length}).`,
        );
    }

    // Best-effort: this can only fire when SESSION_SECRET is present in THIS
    // process's environment. A standalone MCP deployment that does not load the
    // app's env will not be warned, so the deployment docs call it out too. The
    // iss/aud + HS256 pinning below is the primary control and does not depend
    // on this check.
    if (env.SESSION_SECRET && secret === env.SESSION_SECRET) {
        throw new Error(
            "FATAL: MCP_SECRET must not be the same value as SESSION_SECRET — sharing them lets any end-user auth_token authenticate as an MCP client.",
        );
    }

    return secret;
}

/**
 * Mint an MCP client token.
 *
 * @param {string} username
 * @param {string} secret
 * @returns {string}
 */
export function signMcpToken(username, secret) {
    return jwt.sign({ username, role: "ai-assistant" }, secret, {
        algorithm: "HS256",
        issuer: MCP_ISSUER,
        audience: MCP_AUDIENCE,
        expiresIn: MCP_TOKEN_TTL,
    });
}

/**
 * Verify an MCP client token. Throws on any failure — callers must treat a
 * throw as "not authenticated" and must never fall through to a permissive path.
 *
 * @param {string} token
 * @param {string} secret
 * @returns {jwt.JwtPayload & { username?: string, role?: string }}
 */
export function verifyMcpToken(token, secret) {
    return jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: MCP_ISSUER,
        audience: MCP_AUDIENCE,
    });
}
