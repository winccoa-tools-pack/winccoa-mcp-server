/**
 * McpServer factory.
 *
 * Creates and configures the MCP server with all WinCC OA tools and resources.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerAllTools } from "./tools/register-all.js";

// __dirname is available in CJS Node.js context (the bundle target is CJS)
const __dir = __dirname;

/**
 * Load a resource file from disk relative to this module's directory.
 * Returns a placeholder string if the file does not exist, rather than throwing.
 */
function loadResource(relativePath: string): string {
  try {
    return readFileSync(join(__dir, relativePath), "utf8");
  } catch {
    return `[Resource not found: ${relativePath}]`;
  }
}

/**
 * Load a resource from an absolute path.
 * Returns a placeholder string if the file does not exist.
 */
function loadResourceAbsolute(absolutePath: string, label: string): string {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    return `[${label}: file not found at ${absolutePath}]`;
  }
}

// Load resources at module startup (once, not per-request).
// In production (dist/), these files are copied alongside the bundle.
// In development (tsx), they are read from src/resources/.
const systemPromptText = loadResource("resources/systemprompt.md");
const conventionsText = loadResource("resources/conventions.md");

// Field-specific guidelines
const fieldName = process.env.WINCCOA_FIELD ?? "default";
const validFields = new Set(["default", "oil", "transport"]);
const resolvedField = validFields.has(fieldName) ? fieldName : "default";
if (!validFields.has(fieldName)) {
  console.warn(`[server] Unknown WINCCOA_FIELD "${fieldName}", falling back to "default".`);
}
const fieldText = loadResource(`resources/fields/${resolvedField}.md`);

// Project-specific instructions
const projectInstructionsPath = process.env.WINCCOA_PROJECT_INSTRUCTIONS;
const projectText = projectInstructionsPath
  ? loadResourceAbsolute(projectInstructionsPath, "project instructions")
  : "No project-specific instructions configured. Set WINCCOA_PROJECT_INSTRUCTIONS to a markdown file path.";

/**
 * Create a fully configured MCP server with all WinCC OA tools and resources.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAllTools(server);
  registerResources(server);

  return server;
}

/**
 * Register MCP resources that provide LLM context about WinCC OA usage.
 */
function registerResources(server: McpServer): void {
  server.resource(
    "instructions://system",
    "System Instructions",
    async () => ({
      contents: [
        {
          uri: "instructions://system",
          text: systemPromptText,
          mimeType: "text/markdown",
        },
      ],
    }),
  );

  server.resource(
    "instructions://conventions",
    "WinCC OA Naming Conventions",
    async () => ({
      contents: [
        {
          uri: "instructions://conventions",
          text: conventionsText,
          mimeType: "text/markdown",
        },
      ],
    }),
  );

  server.resource(
    "instructions://field",
    `Field Safety Guidelines (${resolvedField})`,
    async () => ({
      contents: [
        {
          uri: "instructions://field",
          text: fieldText,
          mimeType: "text/markdown",
        },
      ],
    }),
  );

  server.resource(
    "instructions://project",
    "Project-Specific Instructions",
    async () => ({
      contents: [
        {
          uri: "instructions://project",
          text: projectText,
          mimeType: "text/markdown",
        },
      ],
    }),
  );
}
