# CardXC MCP Server - Unified Connection Guide

## Overview
When the Replit repl is running, both **Cursor** and **Google Antigravity** can connect to the same MCP server on port 8080 simultaneously.

## Server URL
```
https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080
```

## Authentication
- **API Key**: `cardxc-mcp-key` (or set `MCP_API_KEY` environment variable)
- **JWT Auth**: Get token from `/auth/token` endpoint

---

## Cursor IDE Setup

### Option 1: Direct API Key (Recommended)
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "cardxc": {
      "type": "http",
      "url": "https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/mcp",
      "headers": {
        "X-API-Key": "cardxc-mcp-key"
      }
    }
  }
}
```

### Option 2: JWT Token Auth
1. Get token:
```bash
curl -X POST https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/auth/token \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "cardxc-mcp-dev-key", "username": "cursor"}'
```

2. Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "cardxc": {
      "type": "http",
      "url": "https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

---

## Google Antigravity Setup

### MCP Manifest URLs
- Primary: `https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/mcp/manifest`
- Alternative: `https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/.well-known/mcp.json`

### Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp/manifest` | GET | MCP manifest for discovery |
| `/mcp/tools` | GET | Tools in Gemini function format |
| `/mcp/initialize` | POST | MCP protocol handshake |
| `/mcp/tools/list` | GET | List available tools (auth required) |
| `/mcp/tools/call` | POST | Execute a tool (auth required) |

### Configuration
Add to Antigravity MCP Servers:
```json
{
  "mcpServers": {
    "cardxc": {
      "transport": {
        "type": "http",
        "url": "https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/mcp/tools/call"
      },
      "headers": {
        "X-API-Key": "cardxc-mcp-key"
      }
    }
  }
}
```

---

## Available Tools (Both IDEs)

| Tool | Description |
|------|-------------|
| `list_files` | List all files in the project |
| `read_file` | Read file contents |
| `write_file` | Write content to files |
| `search_files` | Search for files containing patterns |
| `run_command` | Execute shell commands |
| `query_database` | Run SQL queries on PostgreSQL |
| `get_project_info` | Get project structure info |
| `get_system_health` | Check API health status |
| `get_logs` | Retrieve recent application logs |
| `ai_analyze` | Use Gemini AI to analyze code/problems |
| `ai_generate_code` | Generate code based on requirements |
| `ai_fix_error` | Analyze and fix code errors |

---

## Quick Test

### Test with curl:
```bash
# Health check (no auth required)
curl https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/health

# List tools (no auth required)
curl https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/tools

# Execute tool with API key
curl -X POST https://793618d4-c16b-4701-a2be-232161251204-00-35sbezbq4kz3m.janeway.replit.dev:8080/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: cardxc-mcp-dev-key" \
  -d '{"tool": "list_files", "args": {}}'
```

---

## Simultaneous Usage

Both Cursor and Antigravity can connect to the same MCP server at the same time because:

1. **Stateless HTTP**: Each request is independent
2. **No session conflicts**: JWT/API key auth is per-request
3. **Shared database**: Both access the same PostgreSQL database
4. **Shared filesystem**: Both can read/write the same project files

### Best Practices
- Use different usernames when getting JWT tokens for tracking
- Be careful with simultaneous file writes (may cause conflicts)
- Use `query_database` for read operations, avoid conflicting writes

---

## Troubleshooting

### Connection refused
- Make sure Replit repl is running
- Check if MCP Server workflow is active

### 401 Unauthorized
- Verify API key is correct: `cardxc-mcp-dev-key`
- If using JWT, token may be expired (24h validity)

### 403 Forbidden
- Token is invalid or malformed
- Try getting a new token from `/auth/token`

### Tool execution fails
- Check tool name spelling
- Verify required arguments are provided
- Check server logs for detailed error messages
