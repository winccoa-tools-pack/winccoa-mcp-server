# WinCC OA MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes WinCC OA datapoint operations as LLM-callable tools. It runs inside a **WinCC OA Node.js Manager** and uses the native `winccoa-manager` add-on to interact with the WinCC OA runtime.

## Features

| Tool | Description | Hint |
|------|-------------|------|
| `winccoa_dp_get` | Read one or more datapoint element values | read-only |
| `winccoa_dp_set` | Write values (fire-and-forget or confirmed) | write |
| `winccoa_dp_create` | Create a new datapoint | write |
| `winccoa_dp_delete` | Delete a datapoint | **destructive** |
| `winccoa_dp_copy` | Copy a datapoint to a new name | write |
| `winccoa_dp_names` | List DPs matching a pattern | read-only |
| `winccoa_dp_exists` | Check whether a DP identifier exists | read-only |
| `winccoa_dp_query` | Run a WinCC OA SQL-like query | read-only |
| `winccoa_dp_types` | List datapoint types matching a pattern | read-only |

## Prerequisites

- **WinCC OA 3.20** (or compatible) with the Node.js Manager enabled
- **Node.js 18+** (bundled with WinCC OA or system-installed)
- The `winccoa-manager` native add-on (provided by the WinCC OA runtime – **not on npm**)

## Installation

```bash
cd winccoa-mcp-server
npm install
npm run build
```

This compiles TypeScript sources from `src/` into `dist/`.

## Configuration

Since the WinCC OA Node.js Manager does not support command-line arguments, all configuration is done through a **`.env` file** placed next to the built entry point (or in the working directory).

A default `.env` file is included in the repository:

```env
# Transport mode: "stdio" or "http"
MCP_TRANSPORT=stdio

# Port for the HTTP transport (only used when MCP_TRANSPORT=http)
MCP_HTTP_PORT=3000

# Maximum response size in characters to prevent overwhelming the LLM context
MCP_CHARACTER_LIMIT=25000
```

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_TRANSPORT` | `"stdio"` or `"http"` | `stdio` |
| `MCP_HTTP_PORT` | Port for HTTP transport | `3000` |
| `MCP_CHARACTER_LIMIT` | Max response length (chars) | `25000` |

## Usage

### stdio transport (default)

The server communicates over stdin / stdout. Use this when the MCP client (e.g. Claude Desktop, VS Code) starts the process directly or when testing with MCP Inspector.

```bash
node dist/index.js
```

### HTTP transport

Set `MCP_TRANSPORT=http` in your `.env` file, then start the server. It will listen on the port specified by `MCP_HTTP_PORT`.

```bash
node dist/index.js
```

## Integration with WinCC OA

This server is designed to be run as **customer code** inside a WinCC OA Node.js Manager. The typical setup:

1. Place the built `dist/` folder (or the whole project) in your WinCC OA project's scripts directory.
2. Configure a Node.js Manager in the WinCC OA console with this server as the entry script.
3. The WinCC OA bootstrap will load the native `winccoa-manager` add-on, then execute `dist/index.js`.

### MCP client configuration

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "winccoa": {
      "command": "node",
      "args": ["C:/path/to/winccoa-mcp-server/dist/index.js"]
    }
  }
}
```

#### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "winccoa": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/path/to/winccoa-mcp-server/dist/index.js"]
    }
  }
}
```

For HTTP transport, point the client to `http://localhost:3000/mcp` (or your configured port).

## Development

```bash
# Run in development mode (tsx, no build step)
npm run dev

# Test with MCP Inspector
npm run inspect
```

To switch transports during development, edit the `.env` file.

## Project structure

```
src/
├── index.ts                 # Entry point – transport setup
├── server.ts                # McpServer creation
├── constants.ts             # Shared constants
├── winccoa-client.ts        # WinccoaManager singleton
├── types/
│   └── winccoa-manager.d.ts # Type declarations for native add-on
├── tools/
│   ├── register-all.ts      # Tool registration orchestrator
│   ├── dp-get.ts            # winccoa_dp_get
│   ├── dp-set.ts            # winccoa_dp_set
│   ├── dp-create.ts         # winccoa_dp_create
│   ├── dp-delete.ts         # winccoa_dp_delete
│   ├── dp-copy.ts           # winccoa_dp_copy
│   ├── dp-names.ts          # winccoa_dp_names
│   ├── dp-exists.ts         # winccoa_dp_exists
│   ├── dp-query.ts          # winccoa_dp_query
│   └── dp-types.ts          # winccoa_dp_types
└── utils/
    ├── error-handler.ts     # WinCC OA error handling
    └── formatters.ts        # Response formatting helpers
```

## Adding new tools

1. Create `src/tools/your-tool.ts` following the existing pattern (Zod schema + `registerTool()`).
2. Import and call your registration function in `src/tools/register-all.ts`.
3. Rebuild with `npm run build`.

## License

MIT
