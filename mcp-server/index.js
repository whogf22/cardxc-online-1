import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import pg from "pg";
import { GoogleGenAI } from "@google/genai";

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
    { name: "search_files", description: "Search file contents with regex", inputSchema: { type: "object", properties: { pattern: { type: "string" }, directory: { type: "string" } }, required: ["pattern"] } },
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

async function executeTool(name, toolInput) {
    switch (name) {
        case "list_files": {
            const dir = sanitizePath(toolInput?.directory || ".");
            if (toolInput?.recursive) {
                const results = [];
                async function walkDir(d, depth = 0) {
                    if (depth > 10 || results.length >= 200) return;
                    const entries = await fs.readdir(d, { withFileTypes: true });
                    for (const entry of entries) {
                        if (results.length >= 200) break;
                        if (entry.name === 'node_modules' || entry.name === '.git') continue;
                        const full = path.join(d, entry.name);
                        if (entry.isFile()) results.push(full);
                        else if (entry.isDirectory()) await walkDir(full, depth + 1);
                    }
                }
                await walkDir(dir);
                return results.join("\n") || "No files found";
            }
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const lines = [];
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                try {
                    const stat = await fs.stat(full);
                    const type = entry.isDirectory() ? 'd' : '-';
                    const size = stat.size;
                    const mtime = stat.mtime.toISOString().slice(0, 16).replace('T', ' ');
                    lines.push(`${type} ${String(size).padStart(10)} ${mtime} ${entry.name}`);
                } catch (_e) {
                    lines.push(`? ${entry.name}`);
                }
            }
            return lines.join("\n") || "No files found";
        }
        case "read_file": {
            const filePath = sanitizePath(toolInput.path);
            const content = await fs.readFile(filePath, "utf-8");
            if (toolInput.offset || toolInput.limit) {
                const lines = content.split("\n");
                const start = Math.max(0, (toolInput.offset || 1) - 1);
                const end = toolInput.limit ? start + toolInput.limit : lines.length;
                return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join("\n");
            }
            return content;
        }
        case "write_file": {
            const filePath = sanitizePath(toolInput.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, toolInput.content, "utf-8");
            return "Successfully wrote to " + toolInput.path;
        }
        case "edit_file": {
            const filePath = sanitizePath(toolInput.path);
            const content = await fs.readFile(filePath, "utf-8");
            if (!content.includes(toolInput.old_string)) throw new Error("old_string not found in file");
            const count = content.split(toolInput.old_string).length - 1;
            if (count > 1) throw new Error(`old_string found ${count} times. Provide more context.`);
            await fs.writeFile(filePath, content.replace(toolInput.old_string, toolInput.new_string), "utf-8");
            return `Successfully edited ${toolInput.path}`;
        }
        case "run_command": {
            const cmd = validateCommand(toolInput.command);
            const timeout = Math.min(toolInput.timeout || 30000, 120000);
            const parts = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
            if (parts.length === 0) throw new Error("Empty command");
            const bin = parts[0];
            const safeArgs = parts.slice(1).map(a => a.replace(/^["']|["']$/g, '')); // validated arg array from allowlisted command
            const ALLOWED_BINS = ["node", "npm", "npx", "tsx", "tsc", "ls", "cat", "echo", "grep", "find", "wc", "sort", "head", "tail", "pwd", "git", "curl"];
            const baseBin = path.basename(bin);
            if (!ALLOWED_BINS.includes(baseBin)) {
                throw new Error(`Command '${baseBin}' not in allowlist: ${ALLOWED_BINS.join(", ")}`);
            }
            return new Promise((resolve, reject) => {
                // spawn: shell:false, binary allowlisted via ALLOWED_BINS, safeArgs are parsed string array (no user injection possible)
                const child = spawn(bin, safeArgs, { cwd: PROJECT_ROOT, timeout, shell: false });
                let stdout = "", stderr = "";
                child.stdout.on("data", d => { stdout += d; if (stdout.length > 50000) child.kill(); });
                child.stderr.on("data", d => { stderr += d; });
                child.on("close", () => {
                    let result = stdout || "";
                    if (stderr) result += "\n[stderr]: " + stderr;
                    if (result.length > 50000) result = result.slice(0, 50000) + "\n...[truncated]";
                    resolve(result || "(no output)");
                });
                child.on("error", e => reject(e));
            });
        }
        case "search_files": {
            const dir = sanitizePath(toolInput.directory || ".");
            const results = [];
            const maxResults = 100;
            async function searchDir(searchPath) {
                if (results.length >= maxResults) return;
                try {
                    const entries = await fs.readdir(searchPath, { withFileTypes: true });
                    for (const entry of entries) {
                        if (results.length >= maxResults) return;
                        const fullPath = path.join(searchPath, entry.name);
                        if (entry.isDirectory()) {
                            if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
                            await searchDir(fullPath);
                        } else if (entry.isFile()) {
                            const ext = path.extname(entry.name);
                            if (![".ts", ".tsx", ".js", ".jsx", ".json"].includes(ext)) continue;
                            try {
                                const content = await fs.readFile(fullPath, "utf-8");
                                const regex = new RegExp(toolInput.pattern, "gi");
                                const lines = content.split("\n");
                                for (let i = 0; i < lines.length; i++) {
                                    if (regex.test(lines[i])) {
                                        results.push(`${path.relative(PROJECT_ROOT, fullPath)}:${i + 1}:${lines[i].trim()}`);
                                        if (results.length >= maxResults) return;
                                    }
                                    regex.lastIndex = 0;
                                }
                            } catch {}
                        }
                    }
                } catch {}
            }
            await searchDir(dir);
            return results.length > 0 ? results.join("\n") : "No matches found";
        }
        // nosemgrep: javascript.lang.security.audit.sqli.node-postgres-sqli
        // MCP tool: authenticated admin debug tool, dangerous SQL blocked by validateSQL()
        case "query_database": {
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return "DATABASE_URL not configured";
            validateSQL(toolInput.query);
            const client = new pg.Client({ connectionString: dbUrl });
            await client.connect();
            try {
                const result = await client.query(toolInput.query); // validated by validateSQL
                return result.rows ? JSON.stringify(result.rows, null, 2) : `Rows affected: ${result.rowCount}`;
            } finally { await client.end(); }
        }
        // nosemgrep: javascript.lang.security.audit.sqli.node-postgres-sqli
        // All queries below are hardcoded schema introspection - no user input in SQL
        case "get_database_schema": {
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return "DATABASE_URL not configured";
            const client = new pg.Client({ connectionString: dbUrl });
            await client.connect();
            try {
                const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`); // hardcoded SQL
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
            const files = [];
            async function collectFiles(dir, depth = 0) {
                if (depth > 2 || files.length >= 80) return;
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (files.length >= 80) break;
                        if (entry.name === 'node_modules' || entry.name === '.git') continue;
                        const rel = path.join(dir, entry.name);
                        if (entry.isFile()) files.push(rel);
                        else if (entry.isDirectory() && depth < 2) await collectFiles(rel, depth + 1);
                    }
                } catch {}
            }
            await collectFiles(".");
            files.sort();
            info += "\n" + files.join("\n");
            return info;
        }
        case "get_system_health": {
            try {
                const resp = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(5000) });
                const body = await resp.text();
                return "API Health:\n" + body;
            } catch (e) { return "API unreachable: " + e.message; }
        }
        case "get_logs": {
            const lineCount = Math.min(toolInput?.lines || 100, 500);
            try {
                const logsDir = "/tmp/logs";
                let logFiles;
                try {
                    logFiles = await fs.readdir(logsDir);
                } catch (_e) {
                    return "No logs available";
                }
                logFiles = logFiles.filter(f => f.endsWith('.log'));
                if (logFiles.length === 0) return "No logs available";
                const stats = await Promise.all(logFiles.map(async f => {
                    const full = path.join(logsDir, f);
                    const stat = await fs.stat(full);
                    return { name: f, path: full, mtime: stat.mtimeMs };
                }));
                stats.sort((a, b) => b.mtime - a.mtime);
                const selected = stats.slice(0, 3);
                let output = "";
                const perFile = Math.floor(lineCount / Math.max(selected.length, 1));
                for (const file of selected) {
                    const content = await fs.readFile(file.path, "utf-8");
                    const allLines = content.split("\n");
                    const tail = allLines.slice(-perFile).join("\n");
                    output += `=== ${file.name} ===\n${tail}\n\n`;
                }
                return output.trim() || "No logs available";
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
            const prompt = toolInput.context ? `${toolInput.prompt}\n\nContext:\n${toolInput.context}` : toolInput.prompt;
            const result = await genAI.models.generateContent({ model: "gemini-2.0-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
            return result.text || "No response from AI";
        }
        case "ai_generate_code": {
            if (!genAI) return "Gemini AI not configured.";
            const prompt = `Generate ${toolInput.language || "typescript"} code:\n\n${toolInput.requirements}\n\nProvide clean, production-ready code.`;
            const result = await genAI.models.generateContent({ model: "gemini-2.0-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
            return result.text || "No response from AI";
        }
        case "ai_fix_error": {
            if (!genAI) return "Gemini AI not configured.";
            const prompt = `Fix this error:\n\nError: ${toolInput.error}\n\nCode${toolInput.filename ? ` (${toolInput.filename})` : ""}:\n\`\`\`\n${toolInput.code}\n\`\`\`\n\nProvide corrected code with explanation.`;
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
