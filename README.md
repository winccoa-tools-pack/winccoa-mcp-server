# WinCC OA MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes WinCC OA operations as LLM-callable tools. It runs inside a **WinCC OA Node.js Manager** and uses the native `winccoa-manager` add-on to interact with the WinCC OA runtime.

## Features

- **Datapoints** — read/write values, create/delete/copy DPs, name discovery, SQL-like queries, timed/period writes
- **DP types** — list, inspect, create, change, delete types; name validation
- **Archive** — historical value queries and archive configuration
- **Alarms** — binary/non-binary alarm config and alarm log queries
- **Common metadata** — alias, description, unit, format
- **PV range** — engineering min/max limits for numeric DPEs
- **Manager / PMON** — list, status, start/stop/restart/kill, add/remove, properties, system info
- **OPC UA** — connection CRUD, address mapping, namespace browse
- **ASCII** — DPL export/import via `WCCOAascii`
- **CTRL scripts** — execute inline or file-based CTRL with log capture
- **Address / distrib / smooth / dp_fct** — peripheral and config management

Full parameter reference: [`docs/TOOLS.md`](docs/TOOLS.md) (57 tools across 14 categories).

### Tool overview

| Category | Tools |
|----------|-------|
| `datapoints` | `dp_get`, `dp_set`, `dp_create`, `dp_delete`, `dp_copy`, `dp_names`, `dp_exists`, `dp_query`, `dp_set_timed`, `dp_set_period` |
| `dp_types` | `dp_types`, `dp_type_get`, `dp_type_create`, `dp_type_change`, `dp_type_delete`, `dp_type_name`, `name_check` |
| `archive` | `archive_get`, `archive_config_get`, `archive_config_set`, `archive_config_delete` |
| `alarms` | `alarm_config_get`, `alarm_config_set`, `alarm_config_delete`, `alarm_log_get` |
| `common` | `common_get`, `common_set`, `common_delete` |
| `pv_range` | `pv_range_get`, `pv_range_set`, `pv_range_delete` |
| `manager` | `manager_list`, `manager_status`, `manager_start`, `manager_stop`, `manager_restart`, `manager_kill`, `manager_add`, `manager_remove`, `manager_properties_get`, `manager_properties_set`, `project_name`, `system_info` |
| `opcua` | `opcua_connection_list`, `opcua_connection_add`, `opcua_connection_delete`, `opcua_address_set`, `opcua_browse` |
| `ascii` | `ascii_export`, `ascii_import` |
| `script` | `script_execute` |
| `address` | `address_config_set`, `address_config_delete` |
| `distrib` | `distrib_config_set`, `distrib_config_delete` |
| `smooth` | `smooth_config_set`, `smooth_config_delete` |
| `dp_fct` | `dp_fct_config_set`, `dp_fct_config_delete` |

Registered tool names use the form `category.tool_name` (e.g. `datapoints.dp_get`).

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

This bundles TypeScript sources from `src/` into `dist/index.js` and copies `.env.example` to `dist/`.

## Configuration

Since the WinCC OA Node.js Manager does not support command-line arguments, all configuration is done through a **`.env` file** placed next to the built entry point (or in the working directory).

Copy `.env.example` as a starting point. Minimal example:

```env
# Transport mode: "stdio" or "http"
MCP_TRANSPORT=stdio

# Port for the HTTP transport (only used when MCP_TRANSPORT=http)
# Default 47899 avoids conflicts with common Node.js apps on port 3000
MCP_HTTP_PORT=47899

# Maximum response size in characters to prevent overwhelming the LLM context
MCP_CHARACTER_LIMIT=25000
```

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_TRANSPORT` | `"stdio"` or `"http"` | `stdio` |
| `MCP_HTTP_PORT` | Port for HTTP transport | `47899` |
| `MCP_CHARACTER_LIMIT` | Max response length (chars) | `25000` |
| `MCP_AUTH_TYPE` | HTTP auth: `bearer`, `apikey`, or `none` | `bearer` |
| `MCP_API_TOKEN` | Token required when auth is enabled | — |
| `TOOLS` | Comma-separated categories/tool short names; unset = all | *(all)* |

Full reference (CORS, SSL, rate limits, IP filter, field profiles): [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).

## Usage

### stdio transport (default)

The server communicates over stdin / stdout. Use this when the MCP client (e.g. Claude Desktop, VS Code) starts the process directly or when testing with MCP Inspector.

```bash
node dist/index.js
```

### HTTP transport

Set `MCP_TRANSPORT=http` in your `.env` file, then start the server. It will listen on the port specified by `MCP_HTTP_PORT` (default **47899**).

```bash
node dist/index.js
```

Endpoints:

- `POST /mcp` — MCP protocol (auth required when enabled)
- `GET /health` — health check (no auth)

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

For HTTP transport, point the client to `http://localhost:47899/mcp` (or your configured port) and supply the bearer/API token as configured.

## Development

```bash
# Typecheck
npm run typecheck

# Unit tests
npm test

# Build bundle
npm run build

# Test with MCP Inspector
npm run inspect
```

To switch transports during development, edit the `.env` file.

## Project structure

```
src/
├── index.ts                 # Entry point – transport setup
├── server.ts                # McpServer creation + resources
├── constants.ts             # Shared constants (port, tool filter, limits)
├── winccoa-client.ts        # WinccoaManager singleton
├── config/
│   └── server-config.ts     # HTTP security config from env
├── pmon/                    # PMON TCP client for manager tools
├── types/
│   └── winccoa-manager.d.ts # Type declarations for native add-on
├── tools/
│   ├── register-all.ts      # Tool registration orchestrator
│   ├── datapoints/          # DP read/write/create/query tools
│   ├── dp-types/            # DP type management tools
│   ├── archive/             # Historical data + archive config
│   ├── alarms/              # Alarm config + log
│   ├── common/              # Alias/description/unit/format
│   ├── pv-range/            # Engineering range
│   ├── manager/             # PMON manager lifecycle + system info
│   ├── opcua/               # OPC UA connections, address, browse
│   ├── ascii/               # ASCII export/import
│   ├── script/              # CTRL script execution
│   ├── address/             # Peripheral address config
│   ├── distrib/             # Distribution config
│   ├── smooth/              # Smoothing config
│   └── dp-fct/              # Datapoint function config
├── resources/
│   ├── systemprompt.md      # LLM system instructions
│   ├── conventions.md       # Naming conventions resource
│   └── fields/              # Industry field guidelines
└── utils/                   # Error handling, formatters, helpers
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for request flow and middleware details.

## Adding new tools

1. Create `src/tools/<category>/your-tool.ts` following the existing pattern (Zod schema + `registerTool()`).
2. Register the tool with a canonical name `category.tool_name` (dot separator).
3. Import and call your registration function in `src/tools/register-all.ts`.
4. Add the name to the correct category list in the `CATEGORIES` map.
5. Add unit tests next to the tool file and a section in `docs/TOOLS.md`.
6. Rebuild with `npm run build`.

## Documentation

| Doc | Content |
|-----|---------|
| [`docs/TOOLS.md`](docs/TOOLS.md) | Full tool parameter/return reference |
| [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) | Environment variable reference |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Runtime architecture and structure |
| [`CLAUDE.md`](CLAUDE.md) | Contributor guide for AI agents |

## License

MIT
