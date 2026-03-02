# WinCC OA MCP Server — Configuration Reference

All configuration is done through a `.env` file placed next to the built entry point (`dist/.env`). Copy `.env.example` as a starting point.

The WinCC OA Node.js Manager does not support command-line arguments, so environment variables are the only configuration mechanism.

---

## Table of Contents

- [Transport](#transport)
- [HTTP Server](#http-server)
- [Authentication](#authentication)
- [CORS](#cors)
- [SSL / TLS](#ssl--tls)
- [Rate Limiting](#rate-limiting)
- [IP Filtering](#ip-filtering)
- [Tool Selection](#tool-selection)
- [Field / Industry Context](#field--industry-context)
- [ASCII Manager](#ascii-manager)
- [Validation Rules](#validation-rules)

---

## Transport

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `"stdio"` or `"http"`. Use `stdio` when the MCP client (Claude Desktop, VS Code) launches the process directly. Use `http` for network-accessible deployments. |
| `MCP_CHARACTER_LIMIT` | `25000` | Maximum response length in characters. Responses exceeding this limit are truncated with a warning. Increase only if the LLM client supports a larger context. |

---

## HTTP Server

These variables are only used when `MCP_TRANSPORT=http`.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_HTTP_PORT` | `3000` | TCP port the HTTP server listens on. |
| `MCP_HTTP_HOST` | `127.0.0.1` | IP address to bind to. `127.0.0.1` restricts to localhost only. Use `0.0.0.0` to accept connections from all interfaces (combine with IP filtering). |

**Endpoints:**
- `POST /mcp` — MCP protocol endpoint (authentication required)
- `GET /health` — health check (no authentication required), returns `{ "status": "ok", "version": "...", "uptime": ... }`

---

## Authentication

These variables are only used when `MCP_TRANSPORT=http`.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_AUTH_TYPE` | `bearer` | Authentication scheme: `"bearer"` (Authorization: Bearer header), `"apikey"` (X-API-Key header), or `"none"` (no authentication — **not recommended in production**). |
| `MCP_API_TOKEN` | — | Secret token. **Required** when `MCP_AUTH_TYPE` is `bearer` or `apikey`. The server refuses to start if this is unset with authentication enabled. |

**Example headers:**

```http
# Bearer token
Authorization: Bearer my-secret-token

# API key
X-API-Key: my-secret-token
```

**Generating a secure token:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## CORS

Enable CORS when the MCP client runs in a browser or a different origin than the server.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_CORS_ENABLED` | `false` | Enable CORS middleware. |
| `MCP_CORS_ORIGINS` | `*` | Comma-separated list of allowed origins. Use `*` to allow all origins (not recommended with credentials). |
| `MCP_CORS_CREDENTIALS` | `false` | Allow cookies and credentials in CORS requests. Requires specific origins (not `*`). |

**Example — restrict to specific origins:**

```env
MCP_CORS_ENABLED=true
MCP_CORS_ORIGINS=https://claude.ai,https://app.example.com
MCP_CORS_CREDENTIALS=false
```

---

## SSL / TLS

Enable HTTPS to encrypt traffic between the MCP client and the server.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_SSL_ENABLED` | `false` | Enable HTTPS. When `true`, `MCP_SSL_CERT` and `MCP_SSL_KEY` are required. |
| `MCP_SSL_CERT` | — | Absolute path to the TLS certificate file (PEM format). |
| `MCP_SSL_KEY` | — | Absolute path to the TLS private key file (PEM format). |
| `MCP_SSL_CA` | — | Optional path to CA bundle for mutual TLS (mTLS). |

**Example:**

```env
MCP_SSL_ENABLED=true
MCP_SSL_CERT=C:\certs\server.crt
MCP_SSL_KEY=C:\certs\server.key
```

When SSL is enabled, the `/mcp` endpoint is served over HTTPS and the health endpoint becomes `https://host:port/health`.

---

## Rate Limiting

Protect the server against abuse or runaway LLM loops.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_RATE_LIMIT_ENABLED` | `false` | Enable rate limiting on `POST /mcp`. |
| `MCP_RATE_LIMIT_WINDOW_MS` | `60000` | Time window in milliseconds (default: 1 minute). |
| `MCP_RATE_LIMIT_MAX` | `100` | Maximum requests per window per client IP. Clients exceeding this receive `429 Too Many Requests`. |

**Example — 20 requests per minute:**

```env
MCP_RATE_LIMIT_ENABLED=true
MCP_RATE_LIMIT_WINDOW_MS=60000
MCP_RATE_LIMIT_MAX=20
```

---

## IP Filtering

Allow or block specific client IPs. Applied before authentication.

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_IP_FILTER_ENABLED` | `false` | Enable IP filtering. |
| `MCP_IP_WHITELIST` | — | Comma-separated list of allowed IP addresses. When set, all other IPs are blocked (`403 Forbidden`). |
| `MCP_IP_BLACKLIST` | — | Comma-separated list of blocked IP addresses. Applied after whitelist check. |

**Example — allow only two specific clients:**

```env
MCP_IP_FILTER_ENABLED=true
MCP_IP_WHITELIST=192.168.1.50,192.168.1.51
```

Both whitelist and blacklist can be combined. The whitelist is evaluated first: if a whitelist is set, unlisted IPs are immediately rejected. The blacklist then rejects any explicitly blocked IPs.

---

## Tool Selection

Restrict which tools the server registers. Reducing the tool set decreases LLM context usage and attack surface.

| Variable | Default | Description |
|----------|---------|-------------|
| `TOOLS` | *(unset = all)* | Comma-separated list of category names and/or individual tool names. When unset, all 44 tools are registered. |

**Available categories:**

| Category | Tools included |
|----------|----------------|
| `datapoints` | `dp-get`, `dp-set`, `dp-create`, `dp-delete`, `dp-copy`, `dp-names`, `dp-exists`, `dp-query`, `dp-set-timed`, `dp-set-period` |
| `dp-types` | `dp-types`, `dp-type-get`, `dp-type-create`, `dp-type-change`, `dp-type-delete`, `dp-type-name`, `name-check` |
| `archive` | `archive-get`, `archive-config-get`, `archive-config-set`, `archive-config-delete` |
| `alarms` | `alarm-config-get`, `alarm-config-set`, `alarm-config-delete`, `alarm-log-get` |
| `common` | `common-get`, `common-set`, `common-delete` |
| `pv-range` | `pv-range-get`, `pv-range-set`, `pv-range-delete` |
| `manager` | `manager-list`, `manager-status`, `manager-start`, `manager-stop`, `manager-restart`, `manager-properties-get`, `manager-properties-set`, `system-info` |
| `opcua` | `opcua-connection-list`, `opcua-connection-add`, `opcua-connection-delete`, `opcua-address-set`, `opcua-browse` |
| `ascii` | `ascii-export`, `ascii-import` |
| `script` | `script-execute` |

**Examples:**

```env
# Only datapoint read/write tools and manager monitoring
TOOLS=datapoints,manager

# Mix of category and individual tools
TOOLS=dp-get,dp-set,dp-names,manager-list,system-info

# Read-only datapoints and types only
TOOLS=dp-get,dp-names,dp-exists,dp-query,dp-types,dp-type-get,dp-type-name
```

---

## Field / Industry Context

Load industry-specific safety guidelines into the `instructions://field` MCP resource. The guidelines are automatically included in the LLM's system context when it connects to the server.

| Variable | Default | Description |
|----------|---------|-------------|
| `WINCCOA_FIELD` | `default` | Industry field: `"default"` (general SCADA), `"oil"` (oil & gas), or `"transport"` (transportation/signalling). |
| `WINCCOA_PROJECT_INSTRUCTIONS` | *(none)* | Absolute path to a custom project-specific markdown file. Loaded as the `instructions://project` MCP resource. |

**Field profiles:**

| Value | Description |
|-------|-------------|
| `default` | General SCADA safety guidelines: read-before-write, change management, consequence assessment, monitoring. |
| `oil` | Oil & gas specifics: safety-critical systems are read-only by default, operational limits, compliance requirements. |
| `transport` | Transportation/signalling: signal interlocking, sequencing safety, protocol awareness. |

**Example — oil & gas deployment with custom project rules:**

```env
WINCCOA_FIELD=oil
WINCCOA_PROJECT_INSTRUCTIONS=C:\WinCC_OA\MyProject\mcp-instructions.md
```

The project instructions file can contain any markdown content describing project-specific conventions, naming schemes, forbidden operations, or escalation procedures.

---

## ASCII Manager

Configuration for `winccoa_ascii_export` and `winccoa_ascii_import` tools.

| Variable | Default | Description |
|----------|---------|-------------|
| `WINCCOA_ASCII_BINARY` | `WCCOAascii` | Path to the `WCCOAascii` executable. On Windows, `.exe` is appended automatically if missing. If not an absolute path, the binary must be on `PATH`. |
| `WINCCOA_ASCII_WORK_DIR` | OS temp dir | Directory for temporary DPL files created by the export tool. Default is `%TEMP%` on Windows. |
| `WINCCOA_PROJ` | *(auto)* | WinCC OA project name passed to `WCCOAascii` via `-proj`. Required when the ASCII tool cannot auto-detect the project from its runtime context. |

---

## Validation Rules

The server validates configuration at startup. Violations throw an error with a descriptive message:

| Condition | Error |
|-----------|-------|
| `MCP_TRANSPORT=http` and `MCP_AUTH_TYPE` is `bearer` or `apikey` but `MCP_API_TOKEN` is unset | Startup fails: token required |
| `MCP_SSL_ENABLED=true` but `MCP_SSL_CERT` or `MCP_SSL_KEY` is missing | Startup fails: cert/key paths required |
| `MCP_IP_FILTER_ENABLED=true` but no whitelist or blacklist entries configured | Warning logged (server still starts) |

Validation only runs when `MCP_TRANSPORT=http`; stdio transport ignores all HTTP security settings.

---

## Minimal Configurations

### stdio (development/local)

```env
MCP_TRANSPORT=stdio
```

### HTTP with bearer auth (LAN deployment)

```env
MCP_TRANSPORT=http
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=0.0.0.0
MCP_AUTH_TYPE=bearer
MCP_API_TOKEN=<32-byte hex token>
MCP_IP_FILTER_ENABLED=true
MCP_IP_WHITELIST=192.168.1.50
MCP_RATE_LIMIT_ENABLED=true
MCP_RATE_LIMIT_MAX=50
```

### HTTP with TLS (production)

```env
MCP_TRANSPORT=http
MCP_HTTP_PORT=443
MCP_HTTP_HOST=0.0.0.0
MCP_AUTH_TYPE=bearer
MCP_API_TOKEN=<32-byte hex token>
MCP_SSL_ENABLED=true
MCP_SSL_CERT=C:\certs\server.crt
MCP_SSL_KEY=C:\certs\server.key
MCP_RATE_LIMIT_ENABLED=true
MCP_RATE_LIMIT_MAX=100
MCP_IP_FILTER_ENABLED=true
MCP_IP_WHITELIST=10.0.0.5,10.0.0.6
WINCCOA_FIELD=oil
TOOLS=datapoints,archive,alarms,manager
```
