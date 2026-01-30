import express from "express";
import cors from "cors";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import pg from "pg";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// JWT Secret for MCP authentication - REQUIRE from environment in production
const MCP_SECRET = process.env.MCP_SECRET || process.env.SESSION_SECRET;
if (!MCP_SECRET) {
    console.warn("[MCP] Warning: MCP_SECRET not set. Using development fallback. Set MCP_SECRET or SESSION_SECRET in production.");
}
const JWT_SECRET = MCP_SECRET || "dev-mcp-secret-do-not-use-in-production";

// Initialize Gemini AI client using Replit AI Integrations
const genAI = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "",
    httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
});

// JWT Token verification middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};

// Generate access token endpoint
app.post("/auth/token", async (req, res) => {
    const { apiKey, username } = req.body;

    // Validate API key - require MCP_API_KEY in production
    const validApiKey = process.env.MCP_API_KEY;
    if (!validApiKey) {
        console.warn("[MCP] Warning: MCP_API_KEY not set. Using development fallback.");
    }
    const expectedKey = validApiKey || "cardxc-mcp-dev-key";
    
    if (!apiKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid API key" });
    }

    // Validate username
    const sanitizedUsername = (username || "mcp-client").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);

    const token = jwt.sign(
        { 
            username: sanitizedUsername, 
            role: "ai-assistant",
            iss: "cardxc-mcp",
            aud: "cardxc-mcp-client"
        },
        JWT_SECRET,
        { expiresIn: "8h" }
    );

    res.json({ 
        success: true, 
        token,
        expiresIn: "8h",
        message: "Use this token in Authorization header: Bearer <token>"
    });
});

const tools = [
    {
        name: "list_files",
        description: "List all files in the project directory",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory path to list" },
            },
        },
    },
    {
        name: "read_file",
        description: "Read the contents of a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to read" },
            },
            required: ["path"],
        },
    },
    {
        name: "write_file",
        description: "Write content to a file",
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
        name: "run_command",
        description: "Run a shell command in the project directory",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "Command to execute" },
            },
            required: ["command"],
        },
    },
    {
        name: "query_database",
        description: "Execute a SQL query on the PostgreSQL database",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "SQL query to execute" },
            },
            required: ["query"],
        },
    },
    {
        name: "get_project_info",
        description: "Get information about the project structure",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "get_system_health",
        description: "Check the internal health of the main API server",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "ai_analyze",
        description: "Use Google Gemini AI to analyze code or solve problems",
        inputSchema: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "The prompt or question for the AI" },
                context: { type: "string", description: "Additional context like file content" },
            },
            required: ["prompt"],
        },
    },
    {
        name: "ai_generate_code",
        description: "Use Google Gemini AI to generate code based on requirements",
        inputSchema: {
            type: "object",
            properties: {
                requirements: { type: "string", description: "The code requirements or description" },
                language: { type: "string", description: "Programming language (typescript, javascript, etc.)" },
            },
            required: ["requirements"],
        },
    },
    {
        name: "ai_fix_error",
        description: "Use Google Gemini AI to analyze and fix code errors",
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
        name: "search_files",
        description: "Search for files containing a specific pattern",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Search pattern (regex supported)" },
                directory: { type: "string", description: "Directory to search in" },
            },
            required: ["pattern"],
        },
    },
    {
        name: "get_logs",
        description: "Get recent application logs",
        inputSchema: {
            type: "object",
            properties: {
                lines: { type: "number", description: "Number of log lines to retrieve" },
            },
        },
    },
];

// Public endpoint - list available tools
app.get("/tools", (req, res) => {
    res.json({ tools });
});

// ============================================
// GOOGLE ANTIGRAVITY MCP COMPATIBILITY
// ============================================

// MCP Manifest for Antigravity discovery
const mcpManifest = {
    name: "cardxc-mcp",
    version: "2.0.0",
    description: "CardXC Fintech MCP Server - AI-powered debugging and development tools",
    author: "CardXC",
    homepage: "https://cardxc.online",
    protocol: "mcp",
    capabilities: {
        tools: true,
        resources: false,
        prompts: false
    },
    authentication: {
        type: "bearer",
        tokenEndpoint: "/auth/token"
    }
};

// MCP Manifest endpoint for Antigravity discovery
app.get("/mcp/manifest", (req, res) => {
    res.json(mcpManifest);
});

// Alternative manifest location (some MCP clients check this)
app.get("/.well-known/mcp.json", (req, res) => {
    res.json(mcpManifest);
});

// Convert tools to Gemini-style function declarations for Antigravity
const getAntigravityFunctionDeclarations = () => {
    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
            type: "object",
            properties: tool.inputSchema?.properties || {},
            required: tool.inputSchema?.required || []
        }
    }));
};

// Antigravity-compatible tools endpoint (Gemini function format)
app.get("/mcp/tools", (req, res) => {
    res.json({
        tools: [{
            functionDeclarations: getAntigravityFunctionDeclarations()
        }]
    });
});

// MCP Initialize endpoint for Antigravity handshake
app.post("/mcp/initialize", (req, res) => {
    const { protocolVersion, capabilities, clientInfo } = req.body || {};
    
    console.log("[MCP] Antigravity client connected:", clientInfo?.name || "unknown");
    
    res.json({
        protocolVersion: protocolVersion || "2024-11-05",
        capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
            logging: {}
        },
        serverInfo: {
            name: "cardxc-mcp",
            version: "2.0.0"
        }
    });
});

// MCP Tools list endpoint (standard MCP protocol)
app.get("/mcp/tools/list", authenticateToken, (req, res) => {
    res.json({
        tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
        }))
    });
});

// Shared tool executor function
const executeToolInternal = async (tool, args) => {
    switch (tool) {
        case "list_files": {
            const directory = args?.directory || ".";
            const { stdout } = await execAsync("find " + directory + " -maxdepth 3 -not -path '*/.*' -not -path '*/node_modules/*'");
            return stdout || "No files found";
        }

        case "read_file": {
            return await fs.readFile(args.path, "utf-8");
        }

        case "write_file": {
            const dir = path.dirname(args.path);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(args.path, args.content, "utf-8");
            return "Successfully wrote to " + args.path;
        }

        case "run_command": {
            const { stdout, stderr } = await execAsync(args.command, { timeout: 30000 });
            return stdout + (stderr ? "\nStderr: " + stderr : "");
        }

        case "query_database": {
            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) {
                return "Database not configured. DATABASE_URL is missing.";
            }
            const client = new pg.Client({ connectionString: databaseUrl });
            await client.connect();
            try {
                const queryResult = await client.query(args.query);
                return JSON.stringify(queryResult.rows, null, 2);
            } finally {
                await client.end();
            }
        }

        case "get_project_info": {
            let info = "Project Information:\n\n";
            try {
                const pkg = await fs.readFile("package.json", "utf-8");
                info += "=== package.json ===\n" + pkg + "\n\n";
            } catch (e) {
                info += "No package.json found\n\n";
            }
            const { stdout } = await execAsync("ls -la");
            info += "=== Directory Structure ===\n" + stdout;
            return info;
        }

        case "get_system_health": {
            try {
                const { stdout } = await execAsync('curl -s http://localhost:3001/api/health || echo "Failed to connect"');
                return "API Health Check Response:\n" + stdout;
            } catch (e) {
                return "Health check failed: " + e.message;
            }
        }

        case "ai_analyze": {
            const prompt = args.context 
                ? `${args.prompt}\n\nContext:\n${args.context}`
                : args.prompt;
            const aiResult = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            return aiResult.text || "No response from AI";
        }

        case "ai_generate_code": {
            const prompt = `Generate ${args.language || "code"} based on these requirements:\n\n${args.requirements}\n\nProvide clean, production-ready code with proper error handling.`;
            const aiResult = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            return aiResult.text || "No response from AI";
        }

        case "ai_fix_error": {
            const prompt = `Fix this code error:\n\nError: ${args.error}\n\nCode${args.filename ? ` (${args.filename})` : ""}:\n\`\`\`\n${args.code}\n\`\`\`\n\nProvide the corrected code with an explanation.`;
            const aiResult = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            return aiResult.text || "No response from AI";
        }

        case "search_files": {
            const directory = args.directory || ".";
            try {
                const { stdout } = await execAsync(`grep -rl "${args.pattern}" ${directory} --include="*.js" --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | head -50`);
                return stdout || "No files found matching pattern";
            } catch (e) {
                return "Search failed or no results found";
            }
        }

        case "get_logs": {
            const lines = args.lines || 50;
            try {
                const { stdout } = await execAsync(`tail -n ${lines} /tmp/logs/*.log 2>/dev/null || echo "No logs available"`);
                return stdout;
            } catch (e) {
                return "Failed to retrieve logs: " + e.message;
            }
        }

        default:
            throw new Error("Unknown tool: " + tool);
    }
};

// MCP Tools call endpoint (standard MCP protocol)
app.post("/mcp/tools/call", authenticateToken, async (req, res) => {
    const { name, arguments: args } = req.body;
    
    try {
        const result = await executeToolInternal(name, args || {});
        res.json({
            content: [{ type: "text", text: String(result) }],
            isError: false
        });
    } catch (error) {
        res.json({
            content: [{ type: "text", text: "Error: " + error.message }],
            isError: true
        });
    }
});

// Protected endpoint - execute tools
app.post("/execute", authenticateToken, async (req, res) => {
    const { tool, arguments: args } = req.body;

    try {
        let result;

        switch (tool) {
            case "list_files": {
                const directory = args?.directory || ".";
                const { stdout } = await execAsync("find " + directory + " -maxdepth 3 -not -path '*/.*' -not -path '*/node_modules/*'");
                result = stdout || "No files found";
                break;
            }

            case "read_file": {
                result = await fs.readFile(args.path, "utf-8");
                break;
            }

            case "write_file": {
                const dir = path.dirname(args.path);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(args.path, args.content, "utf-8");
                result = "Successfully wrote to " + args.path;
                break;
            }

            case "run_command": {
                const { stdout, stderr } = await execAsync(args.command, { timeout: 30000 });
                result = stdout + (stderr ? "\nStderr: " + stderr : "");
                break;
            }

            case "query_database": {
                const databaseUrl = process.env.DATABASE_URL;
                if (!databaseUrl) {
                    result = "Database not configured. DATABASE_URL is missing.";
                    break;
                }
                const client = new pg.Client({ connectionString: databaseUrl });
                await client.connect();
                try {
                    const queryResult = await client.query(args.query);
                    result = JSON.stringify(queryResult.rows, null, 2);
                } finally {
                    await client.end();
                }
                break;
            }

            case "get_project_info": {
                let info = "Project Information:\n\n";
                try {
                    const pkg = await fs.readFile("package.json", "utf-8");
                    info += "=== package.json ===\n" + pkg + "\n\n";
                } catch (e) {
                    info += "No package.json found\n\n";
                }
                const { stdout } = await execAsync("ls -la");
                info += "=== Directory Structure ===\n" + stdout;
                result = info;
                break;
            }

            case "get_system_health": {
                try {
                    const { stdout } = await execAsync('curl -s http://localhost:3001/api/health || echo "Failed to connect"');
                    result = "API Health Check Response:\n" + stdout;
                } catch (e) {
                    result = "Health check failed: " + e.message;
                }
                break;
            }

            case "ai_analyze": {
                const prompt = args.context 
                    ? `${args.prompt}\n\nContext:\n${args.context}`
                    : args.prompt;
                const aiResult = await genAI.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                });
                result = aiResult.text || "No response generated";
                break;
            }

            case "ai_generate_code": {
                const language = args.language || "typescript";
                const prompt = `Generate ${language} code for the following requirements. Only provide the code without explanations unless asked:\n\n${args.requirements}`;
                const aiResult = await genAI.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                });
                result = aiResult.text || "No response generated";
                break;
            }

            case "ai_fix_error": {
                const prompt = `Fix this code error:\n\nError: ${args.error}\n\nCode:\n${args.code}\n${args.filename ? `\nFilename: ${args.filename}` : ""}\n\nProvide the corrected code and a brief explanation of the fix.`;
                const aiResult = await genAI.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                });
                result = aiResult.text || "No response generated";
                break;
            }

            case "search_files": {
                const directory = args.directory || ".";
                try {
                    const { stdout } = await execAsync(`grep -r -l "${args.pattern}" ${directory} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" 2>/dev/null | head -50`);
                    result = stdout || "No matches found";
                } catch (e) {
                    result = "No matches found";
                }
                break;
            }

            case "get_logs": {
                const lines = args.lines || 50;
                try {
                    const { stdout } = await execAsync(`ls -t /tmp/logs/*.log 2>/dev/null | head -1 | xargs tail -${lines} 2>/dev/null`);
                    result = stdout || "No logs available";
                } catch (e) {
                    result = "Unable to retrieve logs: " + e.message;
                }
                break;
            }

            default:
                return res.status(400).json({ error: "Unknown tool: " + tool });
        }

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint (public)
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        server: "cardxc-mcp", 
        version: "2.0.0",
        features: ["jwt-auth", "gemini-ai", "database", "file-operations"],
        authenticated: false
    });
});

// Authenticated health check
app.get("/health/auth", authenticateToken, (req, res) => {
    res.json({ 
        status: "ok", 
        server: "cardxc-mcp", 
        version: "2.0.0",
        features: ["jwt-auth", "gemini-ai", "database", "file-operations"],
        authenticated: true,
        user: req.user
    });
});

// Landing page with modern design
app.get("/", (req, res) => {
    const host = req.get("host");
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CardXC MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f23 100%);
      min-height: 100vh;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 800px;
      padding: 3rem;
      text-align: center;
    }
    .logo {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #888;
      font-size: 1.2rem;
      margin-bottom: 2rem;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      backdrop-filter: blur(10px);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(0,255,136,0.1);
      border: 1px solid rgba(0,255,136,0.3);
      padding: 8px 16px;
      border-radius: 50px;
      color: #00ff88;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #00ff88;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .features {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .feature {
      background: rgba(255,255,255,0.03);
      padding: 1rem;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .feature-icon {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .feature-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .feature-desc {
      font-size: 0.85rem;
      color: #888;
    }
    .endpoints {
      text-align: left;
      margin-top: 1.5rem;
    }
    .endpoint {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      margin-bottom: 8px;
      font-family: monospace;
    }
    .method {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .get { background: #00d9ff; color: #000; }
    .post { background: #00ff88; color: #000; }
    .path { color: #fff; }
    .desc { color: #666; font-size: 0.85rem; margin-left: auto; }
    .auth-badge {
      background: rgba(255,193,7,0.2);
      color: #ffc107;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🔌</div>
    <h1>CardXC MCP Server</h1>
    <p class="subtitle">Model Context Protocol for AI Assistants</p>
    <p style="color: #00d9ff; font-size: 0.9rem; margin-top: -1rem;">Compatible with Google Antigravity IDE</p>
    
    <div class="card">
      <div class="status">
        <div class="status-dot"></div>
        Server Running
      </div>
      <p>Port: ${process.env.MCP_PORT || 8080} | Version: 2.0.0</p>
      
      <div class="features">
        <div class="feature">
          <div class="feature-icon">🔐</div>
          <div class="feature-title">JWT Authentication</div>
          <div class="feature-desc">Secure token-based access</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🤖</div>
          <div class="feature-title">Gemini AI</div>
          <div class="feature-desc">Google AI integration</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🗄️</div>
          <div class="feature-title">Database</div>
          <div class="feature-desc">PostgreSQL access</div>
        </div>
        <div class="feature">
          <div class="feature-icon">📁</div>
          <div class="feature-title">File Operations</div>
          <div class="feature-desc">Read, write, search files</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h3 style="margin-bottom: 1rem;">API Endpoints</h3>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/auth/token</span>
          <span class="desc">Get access token</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/tools</span>
          <span class="desc">List available tools</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/execute</span>
          <span class="auth-badge">AUTH</span>
          <span class="desc">Execute a tool</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/health</span>
          <span class="desc">Health check</span>
        </div>
      </div>
      
      <h3 style="margin: 1.5rem 0 1rem; color: #00d9ff;">Antigravity MCP Protocol</h3>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/mcp/manifest</span>
          <span class="desc">MCP manifest</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/mcp/tools</span>
          <span class="desc">Gemini-style tools</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/mcp/initialize</span>
          <span class="desc">MCP handshake</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/mcp/tools/call</span>
          <span class="auth-badge">AUTH</span>
          <span class="desc">Call a tool</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `);
});

const PORT = process.env.MCP_PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log("MCP HTTP Server running on port " + PORT);
    console.log("Features: JWT Auth, Gemini AI, Database Access, File Operations");
});
