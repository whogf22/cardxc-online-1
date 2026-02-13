import express from "express";
import cors from "cors";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import pg from "pg";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";
import { Server } from "@modelcontextprotocol/sdk/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const execAsync = promisify(exec);

const PROJECT_ROOT = path.resolve(".");
const BLOCKED_PATHS = [".env", "node_modules/.cache", ".git/objects"];
const BLOCKED_COMMANDS = ["rm -rf /", "mkfs", "dd if=", ":(){ :|:& };:", "shutdown", "reboot", "halt", "poweroff"];
const DANGEROUS_SQL = /^\s*(DROP\s+(DATABASE|SCHEMA)|TRUNCATE\s+ALL|DELETE\s+FROM\s+\w+\s*;?\s*$)/i;

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const JWT_SECRET = process.env.MCP_SECRET || process.env.SESSION_SECRET || "dev-mcp-secret-do-not-use-in-production";
if (!process.env.MCP_SECRET && !process.env.SESSION_SECRET) {
    console.warn("[MCP] Warning: MCP_SECRET not set. Using development fallback.");
}

let genAI = null;
try {
    const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "";
    if (geminiKey) {
        genAI = new GoogleGenAI({
            apiKey: geminiKey,
            httpOptions: {
                apiVersion: "",
                baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
            },
        });
    }
} catch (e) {
    console.warn("[MCP] Gemini AI not available:", e.message);
}

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(key) {
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + RATE_LIMIT_WINDOW;
    }
    entry.count++;
    rateLimitMap.set(key, entry);
    return entry.count <= RATE_LIMIT_MAX;
}

function sanitizePath(inputPath) {
    const resolved = path.resolve(PROJECT_ROOT, inputPath);
    if (!resolved.startsWith(PROJECT_ROOT)) {
        throw new Error("Access denied: path traversal detected");
    }
    for (const blocked of BLOCKED_PATHS) {
        if (resolved.includes(path.resolve(PROJECT_ROOT, blocked))) {
            throw new Error("Access denied: restricted path");
        }
    }
    return resolved;
}

function validateCommand(command) {
    const lower = command.toLowerCase().trim();
    for (const blocked of BLOCKED_COMMANDS) {
        if (lower.includes(blocked)) {
            throw new Error("Command blocked for safety: " + blocked);
        }
    }
    if (lower.includes("..") && (lower.includes("rm") || lower.includes("cat /etc"))) {
        throw new Error("Suspicious command pattern blocked");
    }
    return command;
}

function validateSQL(query) {
    if (DANGEROUS_SQL.test(query)) {
        throw new Error("Destructive SQL blocked. Use targeted DELETE with WHERE clause or ask an admin.");
    }
    return query;
}

const authenticateToken = (req, res, next) => {
    const clientKey = req.ip || req.connection.remoteAddress || "unknown";
    if (!checkRateLimit(clientKey)) {
        return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    }

    const apiKeyHeader = (req.headers["x-api-key"] || "").toString().trim();
    const configuredApiKey = (process.env.MCP_API_KEY || "cardxc-mcp-dev-key").toString().trim();
    if (apiKeyHeader) {
        if (apiKeyHeader !== configuredApiKey) {
            return res.status(401).json({ error: "Invalid API key" });
        }
        req.user = { username: "api-key-client", role: "ai-assistant", auth: "api-key" };
        return next();
    }

    const authHeader = (req.headers.authorization || "").toString();
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
        return res.status(401).json({ error: "Access token required. Use Authorization: Bearer <token> or X-API-Key header." });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (_error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};

app.post("/auth/token", (req, res) => {
    const { apiKey, username } = req.body;
    const expectedKey = process.env.MCP_API_KEY || "cardxc-mcp-dev-key";

    if (!apiKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid API key" });
    }

    const sanitizedUsername = (username || "mcp-client").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);
    const token = jwt.sign(
        { username: sanitizedUsername, role: "ai-assistant", iss: "cardxc-mcp", aud: "cardxc-mcp-client" },
        JWT_SECRET,
        { expiresIn: "8h" }
    );

    res.json({ success: true, token, expiresIn: "8h", message: "Use this token in Authorization header: Bearer <token>" });
});

const tools = [
    {
        name: "list_files",
        description: "List files and directories in a given path with details",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory path to list (default: project root)" },
                recursive: { type: "boolean", description: "List recursively (default: false)" },
            },
        },
    },
    {
        name: "read_file",
        description: "Read the contents of a file. Supports offset/limit for large files.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to read" },
                offset: { type: "number", description: "Line number to start from (1-indexed, default: 1)" },
                limit: { type: "number", description: "Number of lines to read (default: all)" },
            },
            required: ["path"],
        },
    },
    {
        name: "write_file",
        description: "Write content to a file. Creates parent directories if needed.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to write" },
                content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
        },
    },
    {
        name: "edit_file",
        description: "Edit a file by replacing a specific string with new content. Safer than write_file for partial edits.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to edit" },
                old_string: { type: "string", description: "Exact string to find and replace" },
                new_string: { type: "string", description: "Replacement string" },
            },
            required: ["path", "old_string", "new_string"],
        },
    },
    {
        name: "run_command",
        description: "Run a shell command in the project directory (timeout: 30s). Some destructive commands are blocked.",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "Shell command to execute" },
                timeout: { type: "number", description: "Timeout in ms (default: 30000, max: 120000)" },
            },
            required: ["command"],
        },
    },
    {
        name: "search_files",
        description: "Search file contents using grep (regex supported). Returns matching files and lines.",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Search pattern (regex supported)" },
                directory: { type: "string", description: "Directory to search in (default: project root)" },
                include: { type: "string", description: "File extension filter, e.g. '*.ts' (default: source files)" },
            },
            required: ["pattern"],
        },
    },
    {
        name: "query_database",
        description: "Execute a SQL query on the PostgreSQL database. Destructive queries (DROP DATABASE, TRUNCATE ALL) are blocked.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "SQL query to execute" },
            },
            required: ["query"],
        },
    },
    {
        name: "get_database_schema",
        description: "Get the full database schema: tables, columns, types, indexes, and row counts.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "get_project_info",
        description: "Get project structure, package.json, and directory layout.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "get_system_health",
        description: "Check the health of the main API server and MCP server.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "get_logs",
        description: "Get recent application/workflow logs.",
        inputSchema: {
            type: "object",
            properties: {
                lines: { type: "number", description: "Number of log lines (default: 100)" },
                workflow: { type: "string", description: "Specific workflow name to filter (optional)" },
            },
        },
    },
    {
        name: "get_env_info",
        description: "Get server environment information (Node version, OS, memory, uptime). Does NOT expose secrets.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "ai_analyze",
        description: "Use Gemini AI to analyze code, debug issues, or answer technical questions.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "The question or analysis request" },
                context: { type: "string", description: "Additional context like file content" },
            },
            required: ["prompt"],
        },
    },
    {
        name: "ai_generate_code",
        description: "Use Gemini AI to generate code based on requirements.",
        inputSchema: {
            type: "object",
            properties: {
                requirements: { type: "string", description: "Code requirements or description" },
                language: { type: "string", description: "Programming language (default: typescript)" },
            },
            required: ["requirements"],
        },
    },
    {
        name: "ai_fix_error",
        description: "Use Gemini AI to analyze and fix code errors.",
        inputSchema: {
            type: "object",
            properties: {
                error: { type: "string", description: "The error message" },
                code: { type: "string", description: "The code that caused the error" },
                filename: { type: "string", description: "The filename (optional)" },
            },
            required: ["error", "code"],
        },
    },
    {
        name: "healthCheck",
        description: "Verify MCP server is running and responsive. Returns status and server info.",
        inputSchema: { type: "object", properties: {} },
    },
];

const executeToolInternal = async (tool, args) => {
    switch (tool) {
        case "list_files": {
            const dir = sanitizePath(args?.directory || ".");
            if (args?.recursive) {
                const { stdout } = await execAsync(`find "${dir}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -200`);
                return stdout || "No files found";
            }
            const { stdout } = await execAsync(`ls -la "${dir}"`);
            return stdout || "No files found";
        }

        case "read_file": {
            const filePath = sanitizePath(args.path);
            const content = await fs.readFile(filePath, "utf-8");
            if (args.offset || args.limit) {
                const lines = content.split("\n");
                const start = Math.max(0, (args.offset || 1) - 1);
                const end = args.limit ? start + args.limit : lines.length;
                return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join("\n");
            }
            return content;
        }

        case "write_file": {
            const filePath = sanitizePath(args.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, args.content, "utf-8");
            return "Successfully wrote to " + args.path;
        }

        case "edit_file": {
            const filePath = sanitizePath(args.path);
            const content = await fs.readFile(filePath, "utf-8");
            if (!content.includes(args.old_string)) {
                throw new Error("old_string not found in file. Make sure it matches exactly.");
            }
            const count = content.split(args.old_string).length - 1;
            if (count > 1) {
                throw new Error(`old_string found ${count} times. Provide more context to make it unique.`);
            }
            const newContent = content.replace(args.old_string, args.new_string);
            await fs.writeFile(filePath, newContent, "utf-8");
            return `Successfully edited ${args.path} (replaced 1 occurrence)`;
        }

        case "run_command": {
            const cmd = validateCommand(args.command);
            const timeout = Math.min(args.timeout || 30000, 120000);
            const { stdout, stderr } = await execAsync(cmd, { timeout, cwd: PROJECT_ROOT });
            let result = stdout || "";
            if (stderr) result += "\n[stderr]: " + stderr;
            if (result.length > 50000) result = result.slice(0, 50000) + "\n...[truncated]";
            return result || "(no output)";
        }

        case "search_files": {
            const dir = sanitizePath(args.directory || ".");
            const include = args.include || "*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.json --include=*.css --include=*.sql";
            const safePattern = args.pattern.replace(/"/g, '\\"');
            try {
                const { stdout } = await execAsync(
                    `grep -rn --include="${include}" "${safePattern}" "${dir}" 2>/dev/null | head -100`,
                    { timeout: 15000 }
                );
                return stdout || "No matches found";
            } catch (_e) {
                return "No matches found";
            }
        }

        case "query_database": {
            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) return "Database not configured. DATABASE_URL is missing.";
            validateSQL(args.query);
            const client = new pg.Client({ connectionString: databaseUrl });
            await client.connect();
            try {
                const result = await client.query(args.query);
                if (result.rows) {
                    const json = JSON.stringify(result.rows, null, 2);
                    return json.length > 50000 ? json.slice(0, 50000) + "\n...[truncated]" : json;
                }
                return `Query executed. Rows affected: ${result.rowCount}`;
            } finally {
                await client.end();
            }
        }

        case "get_database_schema": {
            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) return "Database not configured.";
            const client = new pg.Client({ connectionString: databaseUrl });
            await client.connect();
            try {
                const tables = await client.query(`
                    SELECT t.table_name, 
                           (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
                    FROM information_schema.tables t 
                    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
                    ORDER BY t.table_name
                `);
                let schema = "=== Database Schema ===\n\n";
                for (const table of tables.rows) {
                    const cols = await client.query(`
                        SELECT column_name, data_type, is_nullable, column_default
                        FROM information_schema.columns 
                        WHERE table_name = $1 AND table_schema = 'public'
                        ORDER BY ordinal_position
                    `, [table.table_name]);
                    const countResult = await client.query(`SELECT count(*) as cnt FROM "${table.table_name}"`);
                    schema += `\n## ${table.table_name} (${countResult.rows[0].cnt} rows)\n`;
                    for (const col of cols.rows) {
                        schema += `  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ' DEFAULT ' + col.column_default : ''}\n`;
                    }
                }
                const indexes = await client.query(`
                    SELECT indexname, tablename, indexdef 
                    FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname
                `);
                if (indexes.rows.length > 0) {
                    schema += "\n\n=== Indexes ===\n";
                    for (const idx of indexes.rows) {
                        schema += `  ${idx.tablename}.${idx.indexname}: ${idx.indexdef}\n`;
                    }
                }
                return schema;
            } finally {
                await client.end();
            }
        }

        case "get_project_info": {
            let info = "=== CardXC Project Info ===\n\n";
            try {
                const pkg = JSON.parse(await fs.readFile("package.json", "utf-8"));
                info += `Name: ${pkg.name}\nVersion: ${pkg.version}\n`;
                info += `Dependencies: ${Object.keys(pkg.dependencies || {}).length}\n`;
                info += `DevDependencies: ${Object.keys(pkg.devDependencies || {}).length}\n\n`;
                info += "Key Dependencies:\n";
                for (const [k, v] of Object.entries(pkg.dependencies || {})) {
                    info += `  ${k}: ${v}\n`;
                }
            } catch (_e) {
                info += "No package.json found\n";
            }
            const { stdout } = await execAsync('find . -maxdepth 2 -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | sort | head -100');
            info += "\n=== Project Files (top 2 levels) ===\n" + stdout;
            return info;
        }

        case "get_system_health": {
            let health = "=== System Health ===\n\n";
            health += "MCP Server: RUNNING (port " + (process.env.MCP_PORT || 8080) + ")\n";
            health += "Gemini AI: " + (genAI ? "CONNECTED" : "NOT CONFIGURED") + "\n";
            health += "Database: " + (process.env.DATABASE_URL ? "CONFIGURED" : "NOT CONFIGURED") + "\n\n";
            try {
                const { stdout } = await execAsync('curl -s http://localhost:3001/api/health', { timeout: 5000 });
                health += "API Server Health:\n" + stdout;
            } catch (e) {
                health += "API Server: UNREACHABLE (" + e.message + ")";
            }
            return health;
        }

        case "get_logs": {
            const lines = Math.min(args?.lines || 100, 500);
            try {
                let cmd;
                if (args?.workflow) {
                    const safeName = args.workflow.replace(/[^a-zA-Z0-9_-]/g, "");
                    cmd = `ls -t /tmp/logs/${safeName}*.log 2>/dev/null | head -1 | xargs tail -n ${lines} 2>/dev/null`;
                } else {
                    cmd = `for f in $(ls -t /tmp/logs/*.log 2>/dev/null | head -5); do echo "=== $(basename $f) ==="; tail -n ${Math.floor(lines / 5)} "$f" 2>/dev/null; echo; done`;
                }
                const { stdout } = await execAsync(cmd, { timeout: 10000 });
                return stdout || "No logs available";
            } catch (e) {
                return "Failed to retrieve logs: " + e.message;
            }
        }

        case "get_env_info": {
            const memUsage = process.memoryUsage();
            return JSON.stringify({
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                uptime: Math.floor(process.uptime()) + "s",
                memory: {
                    rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
                },
                cwd: process.cwd(),
                geminiAvailable: !!genAI,
                databaseConfigured: !!process.env.DATABASE_URL,
            }, null, 2);
        }

        case "ai_analyze": {
            if (!genAI) return "Gemini AI is not configured. Set AI_INTEGRATIONS_GEMINI_API_KEY.";
            const prompt = args.context ? `${args.prompt}\n\nContext:\n${args.context}` : args.prompt;
            const result = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            return result.text || "No response from AI";
        }

        case "ai_generate_code": {
            if (!genAI) return "Gemini AI is not configured. Set AI_INTEGRATIONS_GEMINI_API_KEY.";
            const prompt = `Generate ${args.language || "typescript"} code:\n\n${args.requirements}\n\nProvide clean, production-ready code with proper error handling.`;
            const result = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            return result.text || "No response from AI";
        }

        case "ai_fix_error": {
            if (!genAI) return "Gemini AI is not configured. Set AI_INTEGRATIONS_GEMINI_API_KEY.";
            const prompt = `Fix this code error:\n\nError: ${args.error}\n\nCode${args.filename ? ` (${args.filename})` : ""}:\n\`\`\`\n${args.code}\n\`\`\`\n\nProvide the corrected code with explanation.`;
            const result = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            return result.text || "No response from AI";
        }

        case "healthCheck": {
            return JSON.stringify({
                status: "ok",
                server: "cardxc-mcp",
                version: "2.1.0",
                transport: "http",
                uptime: Math.floor(process.uptime()) + "s",
                tools: tools.length,
                gemini: !!genAI,
                database: !!process.env.DATABASE_URL,
                message: "MCP server is running and responsive",
            }, null, 2);
        }

        default:
            throw new Error("Unknown tool: " + tool);
    }
};

app.get("/tools", (req, res) => {
    res.json({ tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
});

const mcpManifest = {
    name: "cardxc-mcp",
    version: "2.1.0",
    description: "CardXC MCP Server — AI-powered debugging, code editing, database access, and development tools for the CardXC fintech platform.",
    author: "GameNova Vault LLC",
    homepage: "https://cardxc.online",
    protocol: "mcp",
    capabilities: { tools: true, resources: false, prompts: false },
    authentication: { type: "bearer", tokenEndpoint: "/auth/token" },
};

app.get("/mcp/manifest", (req, res) => res.json(mcpManifest));
app.get("/.well-known/mcp.json", (req, res) => res.json(mcpManifest));

app.get("/mcp/tools", (req, res) => {
    res.json({
        tools: [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: { type: "object", properties: t.inputSchema?.properties || {}, required: t.inputSchema?.required || [] } })) }]
    });
});

app.post("/mcp/initialize", (req, res) => {
    const { protocolVersion, clientInfo } = req.body || {};
    console.log("[MCP] Client connected:", clientInfo?.name || "unknown");
    res.json({
        protocolVersion: protocolVersion || "2024-11-05",
        capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false }, logging: {} },
        serverInfo: { name: "cardxc-mcp", version: "2.1.0" },
    });
});

app.get("/mcp/tools/list", authenticateToken, (req, res) => {
    res.json({ tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
});

app.post("/mcp/tools/call", authenticateToken, async (req, res) => {
    const { name, arguments: args } = req.body;
    try {
        const result = await executeToolInternal(name, args || {});
        res.json({ content: [{ type: "text", text: String(result) }], isError: false });
    } catch (error) {
        res.json({ content: [{ type: "text", text: "Error: " + error.message }], isError: true });
    }
});

app.post("/execute", authenticateToken, async (req, res) => {
    const { tool, arguments: args } = req.body;
    try {
        const result = await executeToolInternal(tool, args || {});
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

async function setupMcpStreamableHttp() {
    const mcpServer = new Server(
        { name: "cardxc-mcp", version: "2.1.0" },
        { capabilities: { tools: {} } }
    );
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema || { type: "object", properties: {} } })),
    }));
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
            const result = await executeToolInternal(request.params.name, request.params.arguments || {});
            return { content: [{ type: "text", text: String(result) }] };
        } catch (e) {
            return { content: [{ type: "text", text: String(e.message) }], isError: true };
        }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    app.all("/mcp", (req, res) => {
        transport.handleRequest(req, res, req.body).catch((err) => {
            console.error("[MCP] Streamable HTTP error:", err);
            if (!res.headersSent) res.status(500).json({ error: String(err.message) });
        });
    });
}

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        server: "cardxc-mcp",
        version: "2.1.0",
        uptime: Math.floor(process.uptime()) + "s",
        tools: tools.length,
        features: ["jwt-auth", "api-key-auth", "gemini-ai", "database", "file-operations", "rate-limiting"],
    });
});

app.get("/health/auth", authenticateToken, (req, res) => {
    res.json({
        status: "ok",
        server: "cardxc-mcp",
        version: "2.1.0",
        authenticated: true,
        user: req.user,
        tools: tools.length,
    });
});

app.get("/", (req, res) => {
    const host = req.get("host");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CardXC MCP Server</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0D0D0D;min-height:100vh;color:#fff}
    .wrap{max-width:900px;margin:0 auto;padding:2rem}
    h1{font-size:2.2rem;background:linear-gradient(90deg,#84CC16,#65a30d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.3rem}
    .sub{color:#888;font-size:1rem;margin-bottom:1.5rem}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.3);padding:6px 14px;border-radius:50px;color:#84CC16;font-weight:600;font-size:.85rem;margin-bottom:1.5rem}
    .dot{width:8px;height:8px;background:#84CC16;border-radius:50%;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:1.5rem;margin-bottom:1.2rem}
    .card h3{color:#84CC16;margin-bottom:1rem;font-size:1rem;text-transform:uppercase;letter-spacing:.5px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem;margin-bottom:1rem}
    .feat{background:#222;padding:1rem;border-radius:10px;border:1px solid #333}
    .feat .icon{font-size:1.3rem;margin-bottom:.4rem}
    .feat .t{font-weight:600;font-size:.9rem;margin-bottom:.2rem}
    .feat .d{font-size:.75rem;color:#888}
    .ep{display:flex;align-items:center;gap:10px;padding:10px;background:#111;border-radius:8px;margin-bottom:6px;font-family:monospace;font-size:.85rem;flex-wrap:wrap}
    .m{padding:3px 8px;border-radius:4px;font-size:.7rem;font-weight:700;flex-shrink:0}
    .get{background:#84CC16;color:#000}
    .post{background:#22c55e;color:#000}
    .all{background:#eab308;color:#000}
    .auth{background:rgba(234,179,8,.2);color:#eab308;padding:2px 6px;border-radius:4px;font-size:.65rem;margin-left:4px}
    .desc{color:#666;font-size:.8rem;margin-left:auto}
    .code{background:#111;border:1px solid #333;border-radius:10px;padding:1rem;font-family:monospace;font-size:.8rem;overflow-x:auto;color:#ccc;margin-top:.8rem;white-space:pre-wrap}
    .code .k{color:#84CC16}
    .code .s{color:#22c55e}
    .copy-section{margin-top:.8rem}
    .copy-section h4{color:#ccc;font-size:.85rem;margin-bottom:.5rem}
    .footer{text-align:center;color:#555;font-size:.75rem;margin-top:2rem;padding-top:1rem;border-top:1px solid #222}
    .tabs{display:flex;gap:4px;margin-bottom:1rem}
    .tab{padding:6px 14px;border-radius:8px;font-size:.8rem;cursor:pointer;border:1px solid #333;background:#1a1a1a;color:#888;transition:all .2s}
    .tab.active,.tab:hover{background:rgba(132,204,22,.15);color:#84CC16;border-color:rgba(132,204,22,.3)}
    .tab-content{display:none}
    .tab-content.active{display:block}
  </style>
</head>
<body>
<div class="wrap">
  <div class="badge"><div class="dot"></div> Server Online</div>
  <h1>CardXC MCP Server</h1>
  <p class="sub">Model Context Protocol Server v2.1.0 &mdash; by GameNova Vault LLC</p>

  <div class="card">
    <h3>Capabilities</h3>
    <div class="grid">
      <div class="feat"><div class="icon">🔐</div><div class="t">Auth</div><div class="d">JWT Bearer + API Key</div></div>
      <div class="feat"><div class="icon">📁</div><div class="t">Files</div><div class="d">Read, write, edit, search</div></div>
      <div class="feat"><div class="icon">🗄️</div><div class="t">Database</div><div class="d">PostgreSQL query + schema</div></div>
      <div class="feat"><div class="icon">🤖</div><div class="t">Gemini AI</div><div class="d">Analyze, generate, fix</div></div>
      <div class="feat"><div class="icon">⚡</div><div class="t">Shell</div><div class="d">Run commands (sandboxed)</div></div>
      <div class="feat"><div class="icon">🛡️</div><div class="t">Security</div><div class="d">Rate limit, path protection</div></div>
    </div>
    <p style="color:#888;font-size:.8rem">${tools.length} tools available &bull; Port ${process.env.MCP_PORT || 8080}</p>
  </div>

  <div class="card">
    <h3>Connect Your AI IDE</h3>
    <div class="tabs">
      <div class="tab active" onclick="showTab('cursor')">Cursor</div>
      <div class="tab" onclick="showTab('windsurf')">Windsurf</div>
      <div class="tab" onclick="showTab('antigravity')">Antigravity</div>
      <div class="tab" onclick="showTab('api')">REST API</div>
    </div>

    <div id="cursor" class="tab-content active">
      <p style="color:#aaa;font-size:.85rem;margin-bottom:.5rem">Add to <code>.cursor/mcp.json</code>:</p>
      <div class="code">{
  <span class="k">"mcpServers"</span>: {
    <span class="k">"cardxc"</span>: {
      <span class="k">"url"</span>: <span class="s">"https://${host}/mcp"</span>,
      <span class="k">"headers"</span>: {
        <span class="k">"X-API-Key"</span>: <span class="s">"YOUR_MCP_API_KEY"</span>
      }
    }
  }
}</div>
    </div>

    <div id="windsurf" class="tab-content">
      <p style="color:#aaa;font-size:.85rem;margin-bottom:.5rem">Add to <code>~/.codeium/windsurf/mcp_config.json</code>:</p>
      <div class="code">{
  <span class="k">"mcpServers"</span>: {
    <span class="k">"cardxc"</span>: {
      <span class="k">"serverUrl"</span>: <span class="s">"https://${host}/mcp"</span>,
      <span class="k">"headers"</span>: {
        <span class="k">"X-API-Key"</span>: <span class="s">"YOUR_MCP_API_KEY"</span>
      }
    }
  }
}</div>
    </div>

    <div id="antigravity" class="tab-content">
      <p style="color:#aaa;font-size:.85rem;margin-bottom:.5rem">Use the MCP manifest URL:</p>
      <div class="code"><span class="k">Manifest:</span> <span class="s">https://${host}/mcp/manifest</span>
<span class="k">Tools:</span>    <span class="s">https://${host}/mcp/tools</span>
<span class="k">Init:</span>     POST <span class="s">https://${host}/mcp/initialize</span></div>
    </div>

    <div id="api" class="tab-content">
      <p style="color:#aaa;font-size:.85rem;margin-bottom:.5rem">REST API usage:</p>
      <div class="code"><span class="k"># 1. Get token</span>
curl -X POST https://${host}/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"apiKey":"YOUR_MCP_API_KEY","username":"my-ai"}'

<span class="k"># 2. Execute tool</span>
curl -X POST https://${host}/execute \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"tool":"healthCheck","arguments":{}}'

<span class="k"># Or use API Key directly</span>
curl -X POST https://${host}/execute \\
  -H "X-API-Key: YOUR_MCP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"tool":"list_files","arguments":{"directory":"."}}'</div>
    </div>
  </div>

  <div class="card">
    <h3>API Endpoints</h3>
    <div class="ep"><span class="m post">POST</span>/auth/token<span class="desc">Get JWT access token</span></div>
    <div class="ep"><span class="m get">GET</span>/tools<span class="desc">List all tools</span></div>
    <div class="ep"><span class="m post">POST</span>/execute<span class="auth">AUTH</span><span class="desc">Execute any tool</span></div>
    <div class="ep"><span class="m get">GET</span>/health<span class="desc">Public health check</span></div>
    <div class="ep"><span class="m get">GET</span>/health/auth<span class="auth">AUTH</span><span class="desc">Authenticated health</span></div>
    <div class="ep"><span class="m all">ALL</span>/mcp<span class="desc">Streamable HTTP (Cursor)</span></div>
    <div class="ep"><span class="m get">GET</span>/mcp/manifest<span class="desc">MCP manifest</span></div>
    <div class="ep"><span class="m get">GET</span>/mcp/tools<span class="desc">Tools (Gemini format)</span></div>
    <div class="ep"><span class="m post">POST</span>/mcp/initialize<span class="desc">MCP handshake</span></div>
    <div class="ep"><span class="m post">POST</span>/mcp/tools/call<span class="auth">AUTH</span><span class="desc">Call a tool (MCP)</span></div>
    <div class="ep"><span class="m get">GET</span>/mcp/tools/list<span class="auth">AUTH</span><span class="desc">List tools (MCP)</span></div>
    <div class="ep"><span class="m get">GET</span>/.well-known/mcp.json<span class="desc">Auto-discovery</span></div>
  </div>

  <div class="card">
    <h3>Available Tools (${tools.length})</h3>
    <div class="grid">
      ${tools.map(t => `<div class="feat"><div class="t">${t.name}</div><div class="d">${t.description.slice(0, 60)}${t.description.length > 60 ? '...' : ''}</div></div>`).join("")}
    </div>
  </div>

  <div class="footer">
    &copy; ${new Date().getFullYear()} CardXC &mdash; a digital wallet and payments platform operated by GameNova Vault LLC.
  </div>
</div>
<script>
function showTab(id){
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');
}
</script>
</body>
</html>`);
});

const PORT = process.env.MCP_PORT || 8080;
(async () => {
    await setupMcpStreamableHttp();
    app.listen(PORT, "0.0.0.0", () => {
        console.log("MCP HTTP Server running on port " + PORT);
        console.log("Features: JWT Auth, API Key Auth, Gemini AI, Database, File Ops, Rate Limiting");
        console.log("Tools: " + tools.length + " available");
        console.log("Cursor MCP: use URL http://localhost:" + PORT + "/mcp (Streamable HTTP)");
    });
})();
