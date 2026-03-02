# WinCC OA MCP Server — Tool Reference

Tool names use `category/tool_name` format (e.g. `datapoints/dp_get`). Parameters marked **required** must always be supplied.

---

## Table of Contents

- [Datapoint Operations](#datapoint-operations)
- [Datapoint Type Management](#datapoint-type-management)
- [Archive (Historical Data)](#archive-historical-data)
- [Alarm Configuration](#alarm-configuration)
- [Common DPE Metadata](#common-dpe-metadata)
- [PV Range Configuration](#pv-range-configuration)
- [Manager / System](#manager--system)
- [OPC UA Integration](#opc-ua-integration)
- [ASCII Export / Import](#ascii-export--import)
- [CTRL Script Execution](#ctrl-script-execution)

---

## Datapoint Operations

### `datapoints/dp_get`

Read one or more datapoint element values.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to read. Wildcards (`*`, `?`) are rejected. |
| `includeTimestamp` | `boolean` | | Include online timestamp for each DPE. Default: `false`. |
| `includeUnit` | `boolean` | | Include configured unit for each DPE. Default: `false`. |

**Returns**

```json
{
  "dpeNames": ["ExampleDP.value"],
  "values": [42],
  "timestamps": ["2024-01-15T10:30:00.000Z"],
  "units": ["°C"]
}
```

`timestamps` and `units` are only present when the corresponding flag is `true`.

---

### `datapoints/dp_set`

Write one or more datapoint element values.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to write. |
| `values` | `unknown[]` | ✓ | Values to write. Must match `dpeNames` in length and order. |
| `wait` | `boolean` | | Confirmed write (`dpSetWait`). Default: `true`. Set `false` for fire-and-forget. |

**Returns**

```json
{
  "results": {
    "ExampleDP.value": { "success": true }
  },
  "waited": true
}
```

Errors for individual DPEs are isolated; other DPEs in the same call still succeed.

---

### `datapoints/dp_create`

Create a new datapoint.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpName` | `string` | ✓ | Name for the new datapoint. |
| `dpType` | `string` | ✓ | Existing DP type name to use. |
| `systemId` | `number` | | System number for distributed projects. |
| `dpId` | `number` | | Desired DP ID (falls back to a random ID if already taken). |

**Returns**

```json
{ "success": true, "dpName": "ExampleDP" }
```

---

### `datapoints/dp_delete`

Delete a datapoint permanently.

> **Destructive** — all DP configuration and history associations are removed immediately.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpName` | `string` | ✓ | Name of the datapoint to delete. |

**Returns**

```json
{ "success": true, "dpName": "ExampleDP" }
```

---

### `datapoints/dp_copy`

Copy a datapoint to a new name (including all configuration).

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `source` | `string` | ✓ | Source datapoint name. |
| `destination` | `string` | ✓ | New name (must not already exist). |
| `driver` | `number` | | Driver number. Default: `1`. |

**Returns**

```json
{ "success": true, "source": "SourceDP", "destination": "CopyDP" }
```

---

### `datapoints/dp_names`

List datapoint names matching a pattern.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpPattern` | `string` | | Wildcard pattern (`*`, `?`, `[ranges]`, `{alternatives}`). Default: `"*"`. |
| `dpType` | `string` | | Filter by DP type name. |
| `ignoreCase` | `boolean` | | Case-insensitive matching. Default: `false`. |
| `limit` | `number` | | Max results (1–500). Default: `200`. |
| `offset` | `number` | | Zero-based starting index. Default: `0`. |
| `includeTypeName` | `boolean` | | Add type name per DP (enriched only when total ≤ 50). |
| `includeDescription` | `boolean` | | Add description per DP (enriched only when total ≤ 50). |

**Returns**

```json
{
  "pattern": "Pump*",
  "dpType": null,
  "total": 12,
  "offset": 0,
  "limit": 200,
  "count": 12,
  "dpNames": ["Pump1", "Pump2"],
  "typeNames": { "Pump1": "PumpType" },
  "descriptions": { "Pump1": "Main coolant pump" }
}
```

Enrichment fields (`typeNames`, `descriptions`) are omitted when the result exceeds 50 entries.

---

### `datapoints/dp_exists`

Check whether a DP, DPE, config, or attribute identifier exists.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | Identifier to check. |

**Returns**

```json
{ "dpeName": "ExampleDP.value", "exists": true }
```

---

### `datapoints/dp_query`

Run a WinCC OA SQL-like query across DP attributes.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `query` | `string` | ✓ | WinCC OA SQL-like query string (e.g., `SELECT '_online.._value' FROM "*"`). |

**Returns**

```json
{
  "query": "SELECT '_online.._value' FROM \"Pump*\"",
  "rowCount": 3,
  "rows": [
    ["ExampleDP._online.._value"],
    [42]
  ]
}
```

Large result sets are truncated to stay within the response character limit.

---

### `datapoints/dp_set_timed`

Write values to one or more DPEs with a specific timestamp (back-fill).

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `time` | `string` | ✓ | ISO 8601 timestamp applied to all DPEs (e.g., `"2024-01-15T10:30:00.000Z"`). |
| `dpeNames` | `string[]` | ✓ | DPE names to write. |
| `values` | `unknown[]` | ✓ | Values matching `dpeNames` in length and order. |

**Returns**

```json
{ "success": true, "time": "2024-01-15T10:30:00.000Z", "count": 2 }
```

Uses `dpSetTimedWait` (confirmed write). Useful for inserting historical archive entries.

---

### `datapoints/dp_set_period`

Write historical values for a time period in batch (up to 500 entries).

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `entries` | `object[]` | ✓ | Array of `{ time: string (ISO 8601), dpeName: string, value: unknown }`. Max 500 entries. |

**Returns**

```json
[
  { "index": 0, "time": "2024-01-15T10:00:00Z", "dpeName": "Pump1.speed", "success": true },
  { "index": 1, "time": "2024-01-15T10:01:00Z", "dpeName": "Pump1.speed", "success": false, "error": "..." }
]
```

Each entry is written independently — a single failure does not abort the batch.

---

## Datapoint Type Management

### `dp_types/dp_types`

List datapoint types matching a pattern.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `pattern` | `string` | | Wildcard pattern for type names. Default: `""` (all types). |
| `systemId` | `number` | | System ID for querying remote systems. |
| `includeEmpty` | `boolean` | | Include types that have no existing DPs. Default: `true`. |

**Returns**

```json
{ "pattern": "", "count": 5, "dpTypes": ["PumpType", "ValveType"] }
```

---

### `dp_types/dp_type_get`

Get the structure of a datapoint type.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `typeName` | `string` | ✓ | DP type name to inspect. |
| `includeSubTypes` | `boolean` | | Recursively expand referenced sub-types. Default: `false`. |

**Returns**

```json
{
  "typeName": "PumpType",
  "structure": {
    "name": "PumpType",
    "elementType": 23,
    "elementTypeName": "Struct",
    "children": [
      { "name": "speed", "elementType": 9, "elementTypeName": "Float" },
      { "name": "running", "elementType": 23, "elementTypeName": "Bool" }
    ]
  }
}
```

---

### `dp_types/dp_type_create`

Create a new datapoint type.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `structure` | `object` | ✓ | Root node: `{ name, elementTypeName, refName?, children? }`. The root `name` becomes the type name. |

**Element type names:** `Bool`, `Int`, `UInt`, `Long`, `ULong`, `Float`, `String`, `Blob`, `Time`, `LangString`, `Struct`, `Typeref`

**Returns**

```json
{ "success": true, "typeName": "PumpType" }
```

---

### `dp_types/dp_type_change`

Modify an existing datapoint type.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `structure` | `object` | ✓ | Root node matching the existing type with changes. Use `"newName"` field to rename an element. |

**Returns**

```json
{ "success": true, "typeName": "PumpType" }
```

Only fields that differ from the current definition need to be specified.

---

### `dp_types/dp_type_delete`

Delete a datapoint type.

> **Destructive** — all datapoints of this type must be deleted first.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `typeName` | `string` | ✓ | DP type name to delete. |

**Returns**

```json
{ "success": true, "typeName": "PumpType" }
```

---

### `dp_types/dp_type_name`

Get the DP type name for a given datapoint.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpName` | `string` | ✓ | Datapoint name (without element suffix). |

**Returns**

```json
{ "dpName": "Pump1", "dpTypeName": "PumpType" }
```

---

### `dp_types/name_check`

Validate a name against WinCC OA naming rules before creating a DP or type.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `name` | `string` | ✓ | Name to validate. |
| `nameType` | `string` | | Validation context. Default: `"Dp"`. Options: `Dp`, `DpType`, `DpAlias`, `Project`, `SubProject`, `Directory`, `System`. |

**Returns**

```json
{ "name": "Pump 1", "nameType": "Dp", "valid": false, "normalizedName": "Pump_1" }
```

---

## Archive (Historical Data)

### `archive/archive_get`

Read historical values for one or more DPEs from the WinCC OA archive.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to query. |
| `startTime` | `string` | ✓ | ISO 8601 start time (inclusive). |
| `endTime` | `string` | ✓ | ISO 8601 end time (exclusive). |
| `count` | `number` | | Max samples per DPE. |

**Returns**

```json
[
  {
    "dpeName": "Pump1.speed",
    "times": ["2024-01-15T10:00:00Z", "2024-01-15T10:01:00Z"],
    "values": [1450, 1480]
  }
]
```

Only DPEs with an active archive configuration will have data.

---

### `archive/archive_config_get`

Read the archive (smoothing) configuration for one or more DPEs.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to inspect. |

**Returns**

```json
[
  { "dpeName": "Pump1.running", "enabled": false },
  { "dpeName": "Pump1.speed", "enabled": true, "archiveClass": "_NGA_G_1S", "smooth": 0 }
]
```

---

### `archive/archive_config_set`

Enable or update archive configuration for a DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to configure. |
| `archiveClass` | `string` | ✓ | Archive class name (e.g., `"_NGA_G_EVENT"`, `"_NGA_G_1S"`). |
| `smooth` | `number` | | Smoothing type constant. Default: `0`. |
| `correction` | `number` | | Additive correction applied to stored values. |
| `deadband` | `number` | | Deadband threshold for triggering a new archive entry. |

**Returns**

```json
{ "success": true, "dpeName": "Pump1.speed", "archiveClass": "_NGA_G_1S" }
```

---

### `archive/archive_config_delete`

Disable archiving for one or more DPEs.

> Historical data already stored is **not** deleted — only future archiving is disabled.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to disable archiving on. |

**Returns**

```json
{
  "Pump1.speed": { "success": true },
  "Pump1.running": { "success": false, "error": "No archive config found" }
}
```

---

## Alarm Configuration

### `alarms/alarm_config_get`

Read the alarm configuration for a DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to inspect. |

**Returns** (disabled)

```json
{ "dpeName": "Pump1.running", "enabled": false }
```

**Returns** (binary alarm)

```json
{
  "dpeName": "Pump1.running",
  "enabled": true,
  "alarmType": "binary",
  "alertClass": "_warning",
  "activeState": true
}
```

**Returns** (non-binary / limit alarm)

```json
{
  "dpeName": "Pump1.speed",
  "enabled": true,
  "alarmType": "nonBinary",
  "alertClass": "_alert",
  "thresholds": [
    { "level": 1, "lowerLimit": 0, "upperLimit": 500, "alertClass": "_warning" },
    { "level": 2, "lowerLimit": 0, "upperLimit": 200, "alertClass": "_alert" }
  ]
}
```

---

### `alarms/alarm_config_set`

Configure alarm monitoring for a DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to configure. |
| `alarmType` | `string` | ✓ | `"binary"` (Bool DPEs) or `"nonBinary"` (numeric DPEs). |
| `alertClass` | `string` | ✓ | Alert class (e.g., `"_warning"`, `"_alert"`). |
| `activeState` | `boolean` | | Binary only: alarm active when DPE is `true`. Default: `true`. |
| `thresholds` | `object[]` | | Non-binary only: up to 8 levels `{ lowerLimit, upperLimit, alertClass }`. |

**Returns**

```json
{ "success": true, "dpeName": "Pump1.speed", "alarmType": "nonBinary" }
```

The alarm type must match the element's actual data type (binary → Bool; nonBinary → numeric).

---

### `alarms/alarm_config_delete`

Remove alarm configuration from one or more DPEs.

> Alarm history log data is **not** deleted.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to remove alarm config from. |

**Returns**

```json
{
  "Pump1.running": { "success": true },
  "Pump1.speed": { "success": true }
}
```

---

### `alarms/alarm_log_get`

Read the alarm / event log for one or more DPEs.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to query. |
| `startTime` | `string` | ✓ | ISO 8601 start time (inclusive). |
| `endTime` | `string` | ✓ | ISO 8601 end time (exclusive). |
| `count` | `number` | | Max events to return. Default: `200`, max: `1000`. |

**Returns**

```json
{
  "alertEvents": [
    { "time": "2024-01-15T10:30:00Z", "count": 1, "dpe": "Pump1.running" }
  ],
  "values": [true]
}
```

---

## Common DPE Metadata

### `common/common_get`

Read alias, description, format, and/or unit for a DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to query. |
| `fields` | `string[]` | | Fields to retrieve. Default: all. Options: `"alias"`, `"description"`, `"format"`, `"unit"`. |

**Returns**

```json
{
  "dpeName": "Pump1.speed",
  "alias": "P1_SPD",
  "description": { "en_US": "Pump 1 Speed", "de_DE": "Pumpe 1 Drehzahl" },
  "format": "%6.1f",
  "unit": "rpm"
}
```

Description, format, and unit may be either a plain string or a language-keyed object.

---

### `common/common_set`

Set alias, description, format, and/or unit for a DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to update. |
| `alias` | `string` | | Alias string. |
| `description` | `string \| object` | | Plain string or `{ en_US: "...", de_DE: "..." }`. |
| `format` | `string \| object` | | Printf-style format string, or language-keyed object. |
| `unit` | `string \| object` | | Unit string, or language-keyed object. |

At least one field must be provided. Fields are written in parallel; per-field errors are tracked.

**Returns**

```json
{
  "dpeName": "Pump1.speed",
  "alias": { "success": true },
  "unit": { "success": false, "error": "dpSet failed" }
}
```

---

### `common/common_delete`

Clear alias, description, format, and/or unit fields on a DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE whose fields to clear. |
| `fields` | `string[]` | ✓ | Fields to clear: `"alias"`, `"description"`, `"format"`, `"unit"`. |

Clearing sets the field to an empty string. Per-field error tracking applies.

**Returns** — same shape as `common/common_set`.

---

## PV Range Configuration

### `pv_range/pv_range_get`

Read the process value range (engineering limits) for a numeric DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to query (must be numeric). |

**Returns** (disabled)

```json
{ "dpeName": "Pump1.speed", "enabled": false }
```

**Returns** (enabled)

```json
{
  "dpeName": "Pump1.speed",
  "enabled": true,
  "min": 0,
  "max": 3000,
  "correction": 0,
  "norm": 1
}
```

---

### `pv_range/pv_range_set`

Set the process value range for a numeric DPE.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to configure (must be numeric: Int, UInt, Long, ULong, Float, or Dyn variants). |
| `min` | `number` | ✓ | Minimum process value. |
| `max` | `number` | ✓ | Maximum process value. Must be greater than `min`. |
| `correction` | `number` | | Additive correction applied to raw values. |
| `norm` | `number` | | Normalisation factor applied after correction. |

**Returns**

```json
{ "success": true, "dpeName": "Pump1.speed" }
```

---

### `pv_range/pv_range_delete`

Remove PV range configuration from one or more DPEs.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeNames` | `string[]` | ✓ | DPE names to disable PV range on. |

**Returns**

```json
{
  "Pump1.speed": { "success": true }
}
```

---

## Manager / System

RunState values used by manager tools:

| Value | Meaning |
|-------|---------|
| 0 | Unknown |
| 1 | Starting |
| 2 | Running |
| 3 | Stopping |
| 4 | Stopped |
| 5 | Error |
| 6 | Waiting |

---

### `manager/manager_list`

List all WinCC OA managers registered in the PMON DP fabric.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `includeState` | `boolean` | | Include `runState` for each manager. Default: `true`. |

**Returns**

```json
[
  { "num": 1, "dpName": "_pmon:_pmon.Managers.1", "name": "WCCOAdp", "runState": 2 },
  { "num": 5, "dpName": "_pmon:_pmon.Managers.5", "name": "WCCOAnodejs", "runState": 2 }
]
```

---

### `manager/manager_status`

Get detailed status of a specific manager.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `managerNum` | `number` | ✓ | Manager number. |

**Returns**

```json
{
  "managerNum": 5,
  "dpName": "_pmon:_pmon.Managers.5",
  "name": "WCCOAnodejs",
  "state": 2,
  "runState": 2,
  "startCount": 3,
  "options": "-f scripts/mcp-server.js",
  "startMode": 2,
  "killTime": 30,
  "resetTime": 60,
  "resetStartCount": 5,
  "pid": 4892
}
```

`startMode`: 0 = Manual, 1 = Once, 2 = Always.

---

### `manager/manager_start`

Send a start command to a stopped manager via the PMON DP fabric.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `managerNum` | `number` | ✓ | Manager number to start. |

**Returns** — plain text confirmation. Use `manager/manager_status` to verify the resulting run state (PMON may take seconds to bring the manager online).

---

### `manager/manager_stop`

Send a stop command to a running manager via the PMON DP fabric.

> **Self-stop protection**: the tool refuses to stop the manager running the MCP server itself.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `managerNum` | `number` | ✓ | Manager number to stop. |

**Returns** — plain text confirmation.

---

### `manager/manager_restart`

Stop then start a manager (combines `manager_stop` + configurable wait + `manager_start`).

> **Self-stop protection**: the tool refuses to restart the MCP server's own manager.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `managerNum` | `number` | ✓ | Manager number to restart. |
| `waitSeconds` | `number` | | Seconds to wait between stop and start. Default: `10`, max: `120`. |

**Returns** — plain text confirmation with the actual wait duration.

---

### `manager/manager_properties_get`

Read operational properties for a manager (start mode, kill time, restart limits).

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `managerNum` | `number` | ✓ | Manager number. |

**Returns**

```json
{
  "managerNum": 5,
  "name": "WCCOAnodejs",
  "startMode": 2,
  "killTime": 30,
  "resetTime": 60,
  "resetStartCount": 5
}
```

---

### `manager/manager_properties_set`

Write operational properties for a manager. At least one property must be specified.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `managerNum` | `number` | ✓ | Manager number. |
| `startMode` | `number` | | 0 = Manual, 1 = Once, 2 = Always. |
| `killTime` | `number` | | Seconds before force-kill on stop. |
| `resetTime` | `number` | | Minutes before allowing automatic restart after crash. |
| `resetStartCount` | `number` | | Max automatic restart attempts within `resetTime`. |

**Returns** — plain text summary of properties written.

---

### `manager/system_info`

Get WinCC OA system version, paths, languages, and system identity. No parameters.

**Returns**

```json
{
  "version": { "version": "3.20.0.0", "os": "Windows", "patches": [] },
  "paths": { "projPath": "C:\\WinCC_OA\\MyProject", "binPath": "C:\\Program Files\\Siemens\\WinCC_OA\\3.20" },
  "projectLangs": ["en_US", "de_DE"],
  "systemId": 1,
  "systemName": "MyProject"
}
```

---

## OPC UA Integration

### `opcua/opcua_connection_list`

List all OPC UA connections defined in the project.

No parameters.

**Returns**

```json
[
  { "name": "PlcOpcUa", "address": "opc.tcp://192.168.1.10:4840", "active": true }
]
```

Returns an empty array when no connections are configured.

---

### `opcua/opcua_connection_add`

Create a new OPC UA connection DP.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `connectionName` | `string` | ✓ | Name for the new connection DP. |
| `serverAddress` | `string` | ✓ | OPC UA endpoint URL (must start with `opc.tcp://`). |
| `active` | `boolean` | | Enable the connection immediately. Default: `true`. |
| `securityMode` | `string` | | Message security level: `"None"` (default), `"Sign"`, `"SignAndEncrypt"`. |

**Returns**

```json
{
  "success": true,
  "connectionName": "PlcOpcUa",
  "serverAddress": "opc.tcp://192.168.1.10:4840",
  "active": true,
  "securityMode": "None"
}
```

Certificate and user/password authentication must be configured manually in WinCC OA. The OPC UA driver may need a restart for a new connection to become active.

---

### `opcua/opcua_connection_delete`

Delete an OPC UA connection DP and its driver configuration.

> **Destructive** — any DPEs mapped to this connection become orphaned.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `connectionName` | `string` | ✓ | Name of the connection DP to delete. |

**Returns** — plain text confirmation.

---

### `opcua/opcua_address_set`

Map a DPE to an OPC UA node ID on a specific connection.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpeName` | `string` | ✓ | DPE to configure. |
| `connectionName` | `string` | ✓ | Existing OPC UA connection DP name. |
| `nodeId` | `string` | ✓ | OPC UA node ID (e.g., `"ns=2;s=Pump1.Speed"`). |
| `direction` | `string` | ✓ | `"input"` (read), `"output"` (write), or `"input-output"`. |
| `driverNum` | `number` | | OPC UA driver manager number. Default: `1`. |

**Returns**

```json
{
  "success": true,
  "dpeName": "Pump1.speed",
  "nodeId": "ns=2;s=Pump1.Speed",
  "direction": "input",
  "driverNum": 1,
  "connectionName": "PlcOpcUa"
}
```

---

### `opcua/opcua_browse`

Browse the OPC UA address space of a connected server.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `connectionName` | `string` | ✓ | Name of the OPC UA connection DP to browse. |
| `nodeId` | `string` | | Starting node ID. Default: `"ns=0;i=84"` (Objects folder). |
| `maxDepth` | `number` | | Recursion depth (1–5). Default: `2`. |
| `maxNodes` | `number` | | Max nodes to return (1–500). Default: `200`. |

**Returns**

```json
{
  "connectionName": "PlcOpcUa",
  "nodeId": "ns=0;i=84",
  "nodes": [
    { "nodeId": "ns=2;s=Pump1", "browseName": "Pump1", "displayName": "Pump 1", "nodeClass": 1 }
  ]
}
```

Requires WinCC OA 3.18+ with the CTRL OPC UA extension. Uses a CTRL script with a 30-second timeout.

---

## ASCII Export / Import

### `ascii/ascii_export`

Export datapoints to a DPL file using the WCCOAascii tool.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `dpPattern` | `string` | | Semicolon-separated glob patterns. Default: `"*"`. |
| `dpType` | `string` | | Filter by DP type name. |
| `outputFile` | `string` | | Absolute path for the output DPL file. If omitted, a temp file is used. |
| `includeConfigs` | `boolean` | | Include config attributes in the export. Default: `true`. |

**Returns** (when output ≤ 20,000 characters)

```json
{
  "file": "C:\\Temp\\export_1234.dpl",
  "content": "// DPL content...",
  "stdout": "Exported 42 datapoints",
  "exitCode": 0
}
```

**Returns** (when output > 20,000 characters)

```json
{
  "file": "C:\\Temp\\export_1234.dpl",
  "sizeBytes": 85000,
  "message": "Output exceeds inline limit — read the file directly."
}
```

Requires the `WCCOAascii` binary to be on `PATH` or configured via `WINCCOA_ASCII_BINARY`.

---

### `ascii/ascii_import`

Import datapoints from a DPL file using the WCCOAascii tool.

> **Destructive** — modifies project data. Use `dryRun=true` first to validate.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `inputFile` | `string` | ✓ | Absolute path to the DPL file to import. |
| `dryRun` | `boolean` | | Validate without writing. Default: `false`. |
| `inactivateAlert` | `boolean` | | Temporarily deactivate alerts during import. Default: `false`. |
| `localTime` | `boolean` | | Treat timestamps as local time instead of UTC. Default: `false`. |

**Returns**

```json
{
  "stdout": "Import completed: 42 datapoints created",
  "stderr": "",
  "exitCode": 0,
  "dryRun": false
}
```

A non-zero `exitCode` indicates failure or warnings.

---

## CTRL Script Execution

### `script/script_execute`

Execute a CTRL script inside the WinCC OA runtime and return the result.

> **Destructive annotation** — CTRL code can modify any part of the system. Use with care.

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `code` | `string` | ✗ | Inline CTRL code to execute. Mutually exclusive with `filePath`. |
| `filePath` | `string` | ✗ | CTRL script file path or name. Mutually exclusive with `code`. |
| `functionName` | `string` | ✓ | Function within the script to call. |
| `params` | `unknown[]` | | Arguments to pass to the function. Default: `[]`. |
| `paramTypes` | `string[]` | | CTRL types for each parameter. Must match `params` length. Default: `[]`. |
| `timeoutMs` | `number` | | Execution timeout in ms (1–30,000). Default: `5000`. |
| `captureLog` | `boolean` | | Capture the WinCC OA log delta during execution. Default: `true`. |

Exactly one of `code` or `filePath` must be supplied.

**`paramTypes` values:** `void`, `anytype`, `int`, `uint`, `long`, `ulong`, `float`, `bool`, `bit32`, `string`, `time`, `langString`, `blob`

**Returns**

```json
{
  "result": 42,
  "executionTimeMs": 123,
  "logLines": ["[2024-01-15 10:30:00.123] INFO: Pump started"],
  "logFile": "C:\\WinCC_OA\\log\\PVSS_II.log"
}
```

`logLines` contains log entries appended during script execution. `logFile` is `null` when `captureLog` is `false` or no log file is found.
