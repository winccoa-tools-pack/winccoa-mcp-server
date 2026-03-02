/**
 * Centralised server configuration parsed from environment variables.
 *
 * Call validateConfig() on startup when using HTTP transport to catch
 * missing required settings early.
 */

export interface HttpConfig {
  port: number;
  host: string;
  /** "bearer" = Authorization: Bearer <token>, "apikey" = X-API-Key header */
  authType: "bearer" | "apikey" | "none";
  token: string | undefined;
}

export interface CorsConfig {
  enabled: boolean;
  /** Comma-separated list of allowed origins, or "*" */
  origins: string[];
  credentials: boolean;
}

export interface SslConfig {
  enabled: boolean;
  certPath: string | undefined;
  keyPath: string | undefined;
  caPath: string | undefined;
}

export interface RateLimitConfig {
  enabled: boolean;
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window per IP */
  max: number;
}

export interface IpFilterConfig {
  enabled: boolean;
  whitelist: string[];
  blacklist: string[];
}

export interface ServerConfig {
  http: HttpConfig;
  cors: CorsConfig;
  ssl: SslConfig;
  rateLimit: RateLimitConfig;
  ipFilter: IpFilterConfig;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseStringList(value: string | undefined): string[] {
  if (!value || !value.trim()) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * Build the server configuration from environment variables.
 */
export function loadConfig(): ServerConfig {
  const authTypeRaw = process.env.MCP_AUTH_TYPE?.toLowerCase();
  const authType: HttpConfig["authType"] =
    authTypeRaw === "bearer" ? "bearer"
    : authTypeRaw === "apikey" ? "apikey"
    : authTypeRaw === "none" ? "none"
    : "bearer"; // secure default

  const corsOrigins = parseStringList(process.env.MCP_CORS_ORIGINS);

  return {
    http: {
      port: parseNumber(process.env.MCP_HTTP_PORT, 3000),
      host: process.env.MCP_HTTP_HOST ?? "127.0.0.1",
      authType,
      token: process.env.MCP_API_TOKEN,
    },
    cors: {
      enabled: parseBoolean(process.env.MCP_CORS_ENABLED, false),
      origins: corsOrigins.length > 0 ? corsOrigins : ["*"],
      credentials: parseBoolean(process.env.MCP_CORS_CREDENTIALS, false),
    },
    ssl: {
      enabled: parseBoolean(process.env.MCP_SSL_ENABLED, false),
      certPath: process.env.MCP_SSL_CERT,
      keyPath: process.env.MCP_SSL_KEY,
      caPath: process.env.MCP_SSL_CA,
    },
    rateLimit: {
      enabled: parseBoolean(process.env.MCP_RATE_LIMIT_ENABLED, false),
      windowMs: parseNumber(process.env.MCP_RATE_LIMIT_WINDOW_MS, 60_000),
      max: parseNumber(process.env.MCP_RATE_LIMIT_MAX, 100),
    },
    ipFilter: {
      enabled: parseBoolean(process.env.MCP_IP_FILTER_ENABLED, false),
      whitelist: parseStringList(process.env.MCP_IP_WHITELIST),
      blacklist: parseStringList(process.env.MCP_IP_BLACKLIST),
    },
  };
}

/**
 * Validates the config for HTTP transport use.
 * Throws an error with a descriptive message if required settings are missing.
 */
export function validateConfig(config: ServerConfig): void {
  if (config.http.authType !== "none" && !config.http.token) {
    throw new Error(
      "MCP_API_TOKEN is required when HTTP transport is used with authentication. " +
      "Set MCP_AUTH_TYPE=none to disable auth (not recommended in production).",
    );
  }

  if (config.ssl.enabled) {
    if (!config.ssl.certPath) throw new Error("MCP_SSL_CERT path is required when MCP_SSL_ENABLED=true");
    if (!config.ssl.keyPath) throw new Error("MCP_SSL_KEY path is required when MCP_SSL_ENABLED=true");
  }

  if (config.ipFilter.enabled && config.ipFilter.whitelist.length === 0 && config.ipFilter.blacklist.length === 0) {
    console.warn("MCP_IP_FILTER_ENABLED=true but no whitelist or blacklist entries are configured.");
  }
}
