import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import pg from "pg";
import { GoogleGenAI } from "@google/genai";

const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(".");
const BLOCKED_PATHS = [".env", "node_modules/.cache", ".git/objects"];
const BLOCKED_COMMANDS = ["rm -rf /", "mkfs", "dd if=", ":(){ :|:& };:", "shutdown", "reboot", "halt", "poweroff"];
const DANGEROUS_SQL = /^\s*(DROP\s+(DATABASE|SCHEMA)|TRUNCATE\s+ALL|DELETE\s+FROM\s+\w+\s*;?\s*$)/i;

let genAI = null;
try {
    const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "";
    if (geminiKey) {
        genAI = new GoogleGenAI({
            apiKey: geminiKey,
            httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
        });
    }
} catch (e) {
    console.error("[MCP-stdio] Gemini AI not available:", e.message);
}

function sanitizePath(inputPath) {
    const resolved = path.resolve(PROJECT_ROOT, inputPath);
    if (!resolved.startsWith(PROJECT_ROOT)) throw new Error("Access denied: path traversal detected");
    for (const blocked of BLOCKED_PATHS) {
        if (resolved.includes(path.resolve(PROJECT_ROOT, blocked))) throw new Error("Access denied: restricted path");
    }
    return resolved;
}

function validateCommand(command) {
    const lower = command.toLowerCase().trim();
    for (const blocked of BLOCKED_COMMANDS) {
        if (lower.includes(blocked)) throw new Error("Command blocked for safety");
    }
    if (lower.includes("..") && (lower.includes("rm") || lower.includes("cat /etc"))) {
        throw new Error("Suspicious command pattern blocked");
    }
    return command;
}

function validateSQL(query) {
    if (DANGEROUS_SQL.test(query)) throw new Error("Destructive SQL blocked");
    return query;
}

const toolDefs = [
    { name: "list_files", description: "List files in a directory", inputSchema: { type: "object", properties: { directory: { type: "string", description: "Directory path (default: .)" }, recursive: { type: "boolean" } } } },
    { name: "read_file", description: "Read file contents with optional offset/limit", inputSchema: { type: "object", properties: { path: { type: "string" }, offset: { type: "number" }, limit: { type: "number" } }, required: ["path"] } },
    { name: "write_file", description: "Write content to a file", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    { name: "edit_file", description: "Edit file by replacing exact string", inputSchema: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] } },
    { name: "run_command", description: "Run shell command (30s timeout)", inputSchema: { type: "object", properties: { command: { type: "string" }, timeout: { type: "number", description: "Timeout in ms (max 120000)" } }, required: ["command"] } },
    { name: "search_files", description: "Search file contents with grep", inputSchema: { type: "object", properties: { pattern: { type: "string" }, directory: { type: "string" } }, required: ["pattern"] } },
    { name: "query_database", description: "Execute SQL query on PostgreSQL", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "get_database_schema", description: "Get full database schema", inputSchema: { type: "object", properties: {} } },
    { name: "get_project_info", description: "Get project structure info", inputSchema: { type: "object", properties: {} } },
    { name: "get_system_health", description: "Check API server health", inputSchema: { type: "object", properties: {} } },
    { name: "get_logs", description: "Get recent application logs", inputSchema: { type: "object", properties: { lines: { type: "number" } } } },
    { name: "get_env_info", description: "Get server environment info (no secrets)", inputSchema: { type: "object", properties: {} } },
    { name: "ai_analyze", description: "Use Gemini AI to analyze code or debug issues", inputSchema: { type: "object", properties: { prompt: { type: "string" }, context: { type: "string" } }, required: ["prompt"] } },
    { name: "ai_generate_code", description: "Use Gemini AI to generate code", inputSchema: { type: "object", properties: { requirements: { type: "string" }, language: { type: "string" } }, required: ["requirements"] } },
    { name: "ai_fix_error", description: "Use Gemini AI to fix code errors", inputSchema: { type: "object", properties: { error: { type: "string" }, code: { type: "string" }, filename: { type: "string" } }, required: ["error", "code"] } },
    { name: "healthCheck", description: "MCP server health check", inputSchema: { type: "object", properties: {} } },
];

async function executeTool(name, args) {
    switch (name) {
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
            if (!content.includes(args.old_string)) throw new Error("old_string not found in file");
            const count = content.split(args.old_string).length - 1;
            if (count > 1) throw new Error(`old_string found ${count} times. Provide more context.`);
            await fs.writeFile(filePath, content.replace(args.old_string, args.new_string), "utf-8");
            return `Successfully edited ${args.path}`;
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
            const safePattern = args.pattern.replace(/"/g, '\\"');
            try {
                const { stdout } = await execAsync(`grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" "${safePattern}" "${dir}" 2>/dev/null | head -100`, { timeout: 15000 });
                return stdout || "No matches found";
            } catch { return "No matches found"; }
        }
        case "query_database": {
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return "DATABASE_URL not configured";
            validateSQL(args.query);
            const client = new pg.Client({ connectionString: dbUrl });
            await client.connect();
            try {
                const result = await client.query(args.query);
                return result.rows ? JSON.stringify(result.rows, null, 2) : `Rows affected: ${result.rowCount}`;
            } finally { await client.end(); }
        }
        case "get_database_schema": {
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return "DATABASE_URL not configured";
            const client = new pg.Client({ connectionString: dbUrl });
            await client.connect();
            try {
                const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
                let schema = "=== Database Schema ===\n";
                for (const t of tables.rows) {
                    const cols = await client.query(`SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position`, [t.table_name]);
                    const cnt = await client.query(`SELECT count(*) as c FROM "${t.table_name}"`);
                    schema += `\n## ${t.table_name} (${cnt.rows[0].c} rows)\n`;
                    for (const c of cols.rows) schema += `  - ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}\n`;
                }
                return schema;
            } finally { await client.end(); }
        }
        case "get_project_info": {
            let info = "=== CardXC Project ===\n";
            try { const p = JSON.parse(await fs.readFile("package.json", "utf-8")); info += `Name: ${p.name}, Version: ${p.version}\n`; } catch { info += "No package.json\n"; }
            const { stdout } = await execAsync('find . -maxdepth 2 -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | sort | head -80');
            info += "\n" + stdout;
            return info;
        }
        case "get_system_health": {
            try {
                const { stdout } = await execAsync('curl -s http://localhost:3001/api/health', { timeout: 5000 });
                return "API Health:\n" + stdout;
            } catch (e) { return "API unreachable: " + e.message; }
        }
        case "get_logs": {
            const lines = Math.min(args?.lines || 100, 500);
            try {
                const { stdout } = await execAsync(`for f in $(ls -t /tmp/logs/*.log 2>/dev/null | head -3); do echo "=== $(basename $f) ==="; tail -n ${lines} "$f"; echo; done`, { timeout: 10000 });
                return stdout || "No logs available";
            } catch (e) { return "Logs error: " + e.message; }
        }
        case "get_env_info": {
            const memUsage = process.memoryUsage();
            return JSON.stringify({
                node: process.version, platform: process.platform, arch: process.arch,
                uptime: Math.floor(process.uptime()) + "s",
                memory: { rss: Math.round(memUsage.rss / 1024 / 1024) + "MB", heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB" },
                cwd: process.cwd(), geminiAvailable: !!genAI, databaseConfigured: !!process.env.DATABASE_URL,
            }, null, 2);
        }
        case "ai_analyze": {
            if (!genAI) return "Gemini AI not configured.";
            const prompt = args.context ? `${args.prompt}\n\nContext:\n${args.context}` : args.prompt;
            const result = await genAI.models.generateContent({ model: "gemini-2.0-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
            return result.text || "No response from AI";
        }
        case "ai_generate_code": {
            if (!genAI) return "Gemini AI not configured.";
            const prompt = `Generate ${args.language || "typescript"} code:\n\n${args.requirements}\n\nProvide clean, production-ready code.`;
            const result = await genAI.models.generateContent({ model: "gemini-2.0-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
            return result.text || "No response from AI";
        }
        case "ai_fix_error": {
            if (!genAI) return "Gemini AI not configured.";
            const prompt = `Fix this error:\n\nError: ${args.error}\n\nCode${args.filename ? ` (${args.filename})` : ""}:\n\`\`\`\n${args.code}\n\`\`\`\n\nProvide corrected code with explanation.`;
            const result = await genAI.models.generateContent({ model: "gemini-2.0-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
            return result.text || "No response from AI";
        }
        case "healthCheck": {
            return JSON.stringify({ status: "ok", server: "cardxc-mcp", transport: "stdio", tools: toolDefs.length, gemini: !!genAI, database: !!process.env.DATABASE_URL, uptime: Math.floor(process.uptime()) + "s" }, null, 2);
        }
        default: throw new Error("Unknown tool: " + name);
    }
}

const server = new Server(
    { name: "cardxc-mcp", version: "2.1.0" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefs }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const result = await executeTool(request.params.name, request.params.arguments || {});
        return { content: [{ type: "text", text: String(result) }] };
    } catch (error) {
        return { content: [{ type: "text", text: "Error: " + error.message }], isError: true };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CardXC MCP Server (stdio) running - v2.1.0 - " + toolDefs.length + " tools");
}

main().catch(console.error);
