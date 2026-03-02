/**
 * Tool registration orchestrator.
 *
 * Registers all MCP tools with the server. Individual tools or whole categories
 * can be selectively loaded via the TOOLS environment variable.
 *
 * Set TOOLS to a comma-separated list of category names and/or tool names:
 *   TOOLS=datapoints,manager           → all tools in those categories
 *   TOOLS=dp-get,dp-set,manager-list   → only those specific tools
 *
 * Unset (default) loads every tool.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENABLED_TOOLS } from "../constants.js";

import { registerDpGet } from "./datapoints/dp-get.js";
import { registerDpSet } from "./datapoints/dp-set.js";
import { registerDpCreate } from "./datapoints/dp-create.js";
import { registerDpDelete } from "./datapoints/dp-delete.js";
import { registerDpCopy } from "./datapoints/dp-copy.js";
import { registerDpNames } from "./datapoints/dp-names.js";
import { registerDpExists } from "./datapoints/dp-exists.js";
import { registerDpQuery } from "./datapoints/dp-query.js";
import { registerDpTypes } from "./dp-types/dp-types.js";
import { registerDpTypeGet } from "./dp-types/dp-type-get.js";
import { registerDpTypeCreate } from "./dp-types/dp-type-create.js";
import { registerDpTypeChange } from "./dp-types/dp-type-change.js";
import { registerDpTypeDelete } from "./dp-types/dp-type-delete.js";
import { registerDpTypeName } from "./dp-types/dp-type-name.js";
import { registerNameCheck } from "./dp-types/name-check.js";
import { registerDpSetTimed } from "./datapoints/dp-set-timed.js";
import { registerDpSetPeriod } from "./datapoints/dp-set-period.js";
import { registerArchiveGet } from "./archive/archive-get.js";
import { registerArchiveConfigGet } from "./archive/archive-config-get.js";
import { registerArchiveConfigSet } from "./archive/archive-config-set.js";
import { registerArchiveConfigDelete } from "./archive/archive-config-delete.js";
import { registerAlarmConfigGet } from "./alarms/alarm-config-get.js";
import { registerAlarmConfigSet } from "./alarms/alarm-config-set.js";
import { registerAlarmConfigDelete } from "./alarms/alarm-config-delete.js";
import { registerAlarmLogGet } from "./alarms/alarm-log-get.js";
import { registerCommonGet } from "./common/common-get.js";
import { registerCommonSet } from "./common/common-set.js";
import { registerCommonDelete } from "./common/common-delete.js";
import { registerPvRangeGet } from "./pv-range/pv-range-get.js";
import { registerPvRangeSet } from "./pv-range/pv-range-set.js";
import { registerPvRangeDelete } from "./pv-range/pv-range-delete.js";
import { registerManagerList } from "./manager/manager-list.js";
import { registerManagerStatus } from "./manager/manager-status.js";
import { registerManagerStart } from "./manager/manager-start.js";
import { registerManagerStop } from "./manager/manager-stop.js";
import { registerManagerRestart } from "./manager/manager-restart.js";
import { registerManagerPropertiesGet, registerManagerPropertiesSet } from "./manager/manager-properties.js";
import { registerSystemInfo } from "./manager/system-info.js";
import { registerOpcUaConnectionList } from "./opcua/opcua-connection-list.js";
import { registerOpcUaConnectionAdd } from "./opcua/opcua-connection-add.js";
import { registerOpcUaConnectionDelete } from "./opcua/opcua-connection-delete.js";
import { registerOpcUaAddressSet } from "./opcua/opcua-address-set.js";
import { registerOpcUaBrowse } from "./opcua/opcua-browse.js";
import { registerAsciiExport } from "./ascii/ascii-export.js";
import { registerAsciiImport } from "./ascii/ascii-import.js";
import { registerScriptExecute } from "./script/script-execute.js";

// ---------------------------------------------------------------------------
// Category → tool-name mapping (tool name = the string passed to registerTool)
// ---------------------------------------------------------------------------

const CATEGORIES: Record<string, string[]> = {
  datapoints: [
    "datapoints.dp_get",
    "datapoints.dp_set",
    "datapoints.dp_create",
    "datapoints.dp_delete",
    "datapoints.dp_copy",
    "datapoints.dp_names",
    "datapoints.dp_exists",
    "datapoints.dp_query",
    "datapoints.dp_set_timed",
    "datapoints.dp_set_period",
  ],
  "dp-types": [
    "dp_types.dp_types",
    "dp_types.dp_type_get",
    "dp_types.dp_type_create",
    "dp_types.dp_type_change",
    "dp_types.dp_type_delete",
    "dp_types.dp_type_name",
    "dp_types.name_check",
  ],
  archive: [
    "archive.archive_get",
    "archive.archive_config_get",
    "archive.archive_config_set",
    "archive.archive_config_delete",
  ],
  alarms: [
    "alarms.alarm_config_get",
    "alarms.alarm_config_set",
    "alarms.alarm_config_delete",
    "alarms.alarm_log_get",
  ],
  common: [
    "common.common_get",
    "common.common_set",
    "common.common_delete",
  ],
  "pv-range": [
    "pv_range.pv_range_get",
    "pv_range.pv_range_set",
    "pv_range.pv_range_delete",
  ],
  manager: [
    "manager.manager_list",
    "manager.manager_status",
    "manager.manager_start",
    "manager.manager_stop",
    "manager.manager_restart",
    "manager.manager_properties_get",
    "manager.manager_properties_set",
    "manager.system_info",
  ],
  opcua: [
    "opcua.opcua_connection_list",
    "opcua.opcua_connection_add",
    "opcua.opcua_connection_delete",
    "opcua.opcua_address_set",
    "opcua.opcua_browse",
  ],
  ascii: [
    "ascii.ascii_export",
    "ascii.ascii_import",
  ],
  script: [
    "script.script_execute",
  ],
};

// ---------------------------------------------------------------------------
// Build a short-name → canonical-name reverse map from CATEGORIES.
// Short name = the part after the "." with "_" replaced by "-".
// Example: "datapoints.dp_get" → short name "dp-get"
// ---------------------------------------------------------------------------
const SHORT_NAME_MAP: Record<string, string> = {};
for (const tools of Object.values(CATEGORIES)) {
  for (const canonical of tools) {
    const dot = canonical.indexOf(".");
    const shortName = canonical.slice(dot + 1).replace(/_/g, "-");
    SHORT_NAME_MAP[shortName] = canonical;
  }
}

// Expand ENABLED_TOOLS: replace category names with their tool lists,
// keep individual tool names as-is. Result is a Set for O(1) lookup.
function buildAllowSet(filter: string[] | null): Set<string> | null {
  if (!filter) return null; // null = allow all

  const allowed = new Set<string>();
  for (const entry of filter) {
    if (entry in CATEGORIES) {
      for (const tool of CATEGORIES[entry]!) {
        allowed.add(tool);
      }
    } else if (entry in SHORT_NAME_MAP) {
      // Short name like "dp-get" → canonical "datapoints.dp_get"
      allowed.add(SHORT_NAME_MAP[entry]!);
    } else {
      // Pass through as-is (e.g. already fully-qualified "datapoints.dp_get")
      allowed.add(entry);
    }
  }
  return allowed;
}

/**
 * Register every enabled tool with the given MCP server instance.
 */
export function registerAllTools(server: McpServer): void {
  const allowSet = buildAllowSet(ENABLED_TOOLS);

  /** Returns true when the tool should be registered. */
  const allow = (toolName: string): boolean => allowSet === null || allowSet.has(toolName);

  const skipped: string[] = [];
  const loaded: string[] = [];

  function reg(toolName: string, registerFn: (server: McpServer) => void): void {
    if (allow(toolName)) {
      registerFn(server);
      loaded.push(toolName);
    } else {
      skipped.push(toolName);
    }
  }

  // ── Datapoint read ──────────────────────────────────────
  reg("datapoints.dp_get", registerDpGet);
  reg("datapoints.dp_exists", registerDpExists);
  reg("datapoints.dp_names", registerDpNames);
  reg("datapoints.dp_query", registerDpQuery);
  reg("dp_types.dp_types", registerDpTypes);

  // ── Datapoint write ─────────────────────────────────────
  reg("datapoints.dp_set", registerDpSet);
  reg("datapoints.dp_create", registerDpCreate);
  reg("datapoints.dp_delete", registerDpDelete);
  reg("datapoints.dp_copy", registerDpCopy);
  reg("datapoints.dp_set_timed", registerDpSetTimed);
  reg("datapoints.dp_set_period", registerDpSetPeriod);

  // ── Datapoint type management ────────────────────────────
  reg("dp_types.dp_type_get", registerDpTypeGet);
  reg("dp_types.dp_type_create", registerDpTypeCreate);
  reg("dp_types.dp_type_change", registerDpTypeChange);
  reg("dp_types.dp_type_delete", registerDpTypeDelete);
  reg("dp_types.dp_type_name", registerDpTypeName);

  // ── Validation ───────────────────────────────────────────
  reg("dp_types.name_check", registerNameCheck);

  // ── Archive (historical data) ────────────────────────────
  reg("archive.archive_get", registerArchiveGet);
  reg("archive.archive_config_get", registerArchiveConfigGet);
  reg("archive.archive_config_set", registerArchiveConfigSet);
  reg("archive.archive_config_delete", registerArchiveConfigDelete);

  // ── Alarm configuration ──────────────────────────────────
  reg("alarms.alarm_config_get", registerAlarmConfigGet);
  reg("alarms.alarm_config_set", registerAlarmConfigSet);
  reg("alarms.alarm_config_delete", registerAlarmConfigDelete);
  reg("alarms.alarm_log_get", registerAlarmLogGet);

  // ── Common DPE metadata (alias / description / format / unit) ───
  reg("common.common_get", registerCommonGet);
  reg("common.common_set", registerCommonSet);
  reg("common.common_delete", registerCommonDelete);

  // ── PV Range configuration ───────────────────────────────
  reg("pv_range.pv_range_get", registerPvRangeGet);
  reg("pv_range.pv_range_set", registerPvRangeSet);
  reg("pv_range.pv_range_delete", registerPvRangeDelete);

  // ── Manager / System Info ────────────────────────────────
  reg("manager.manager_list", registerManagerList);
  reg("manager.manager_status", registerManagerStatus);
  reg("manager.manager_start", registerManagerStart);
  reg("manager.manager_stop", registerManagerStop);
  reg("manager.manager_restart", registerManagerRestart);
  reg("manager.manager_properties_get", registerManagerPropertiesGet);
  reg("manager.manager_properties_set", registerManagerPropertiesSet);
  reg("manager.system_info", registerSystemInfo);

  // ── OPC UA Integration ───────────────────────────────────
  reg("opcua.opcua_connection_list", registerOpcUaConnectionList);
  reg("opcua.opcua_connection_add", registerOpcUaConnectionAdd);
  reg("opcua.opcua_connection_delete", registerOpcUaConnectionDelete);
  reg("opcua.opcua_address_set", registerOpcUaAddressSet);
  reg("opcua.opcua_browse", registerOpcUaBrowse);

  // ── ASCII Export / Import ────────────────────────────────
  reg("ascii.ascii_export", registerAsciiExport);
  reg("ascii.ascii_import", registerAsciiImport);

  // ── CTRL Script Execution ────────────────────────────────
  reg("script.script_execute", registerScriptExecute);

  if (ENABLED_TOOLS !== null) {
    console.error(`[tools] Loaded ${loaded.length} tools. Skipped ${skipped.length} (filter: TOOLS=${ENABLED_TOOLS.join(",")})`);
  }
}
