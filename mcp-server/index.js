import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import pg from "pg";

const execAsync = promisify(exec);

const server = new Server(
    {
        name: "replit-project-mcp",
        version: "1.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "list_files",
                description: "List all files in the project directory",
                inputSchema: {
                    type: "object",
                    properties: {
                        directory: {
                            type: "string",
                            description: "Directory path to list (default: current directory)",
                        },
                    },
                },
            },
            {
                name: "read_file",
                description: "Read the contents of a file",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Path to the file to read",
                        },
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
                        path: {
                            type: "string",
                            description: "Path to the file to write",
                        },
                        content: {
                            type: "string",
                            description: "Content to write to the file",
                        },
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
                        command: {
                            type: "string",
                            description: "Command to execute",
                        },
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
                        query: {
                            type: "string",
                            description: "SQL query to execute",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_project_info",
                description: "Get information about the project structure and configuration",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "check_logs",
                description: "Check recent logs from the application",
                inputSchema: {
                    type: "object",
                    properties: {
                        lines: {
                            type: "number",
                            description: "Number of lines to retrieve (default: 50)",
                        },
                    },
                },
            },
            {
                name: "get_system_health",
                description: "Check the internal health of the main API server",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "list_files": {
                const directory = args?.directory || ".";
                const { stdout } = await execAsync(`find ${directory} -type f -name "*" | head -100`);
                return {
                    content: [{ type: "text", text: stdout || "No files found" }],
                };
            }

            case "read_file": {
                const filePath = args.path;
                const content = await fs.readFile(filePath, "utf-8");
                return {
                    content: [{ type: "text", text: content }],
                };
            }

            case "write_file": {
                const filePath = args.path;
                const dir = path.dirname(filePath);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(filePath, args.content, "utf-8");
                return {
                    content: [{ type: "text", text: `Successfully wrote to ${filePath}` }],
                };
            }

            case "run_command": {
                const { stdout, stderr } = await execAsync(args.command, { timeout: 30000 });
                return {
                    content: [{ type: "text", text: stdout + (stderr ? `\nStderr: ${stderr}` : "") }],
                };
            }

            case "query_database": {
                const databaseUrl = process.env.DATABASE_URL;
                if (!databaseUrl) {
                    return {
                        content: [{ type: "text", text: "Database not configured. DATABASE_URL environment variable is missing." }],
                    };
                }
                const client = new pg.Client({ connectionString: databaseUrl });
                await client.connect();
                try {
                    const result = await client.query(args.query);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                    };
                } finally {
                    await client.end();
                }
            }

            case "get_project_info": {
                let info = "Project Information:\n\n";

                // Check for package.json
                try {
                    const pkg = await fs.readFile("package.json", "utf-8");
                    info += "=== package.json ===\n" + pkg + "\n\n";
                } catch (e) {
                    info += "No package.json found\n\n";
                }

                // List top-level directories
                const { stdout } = await execAsync("ls -la");
                info += "=== Directory Structure ===\n" + stdout;

                return {
                    content: [{ type: "text", text: info }],
                };
            }

            case "check_logs": {
                const lines = args?.lines || 50;
                try {
                    const { stdout } = await execAsync(`journalctl -n ${lines} --no-pager 2>/dev/null || tail -${lines} /var/log/syslog 2>/dev/null || echo "Logs not available"`);
                    return {
                        content: [{ type: "text", text: stdout }],
                    };
                } catch (e) {
                    return {
                        content: [{ type: "text", text: "Could not retrieve logs: " + e.message }],
                    };
                }
            }

            case "get_system_health": {
                try {
                    // Try to connect to the local API
                    const { stdout } = await execAsync('curl -s http://localhost:3001/api/health || echo "Failed to connect"');
                    return {
                        content: [{ type: "text", text: `API Health Check Response:\n${stdout}` }],
                    };
                } catch (e) {
                    return {
                        content: [{ type: "text", text: `Health check failed: ${e.message}` }],
                        isError: true,
                    };
                }
            }

            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    } catch (error) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server running on stdio");
}

main().catch(console.error);
