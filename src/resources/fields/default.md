# General SCADA Safety Guidelines

These guidelines apply to all WinCC OA operations. Follow them for safe, reliable system interaction.

## Read Before Write

- Always read the current value of a datapoint before changing it.
- Confirm the current state is what you expect before issuing any `dpSet` command.
- For process-critical values, use `datapoints/dp_get` first, verify the value is in the expected range, then write.

## Change Management

- Document every intended change and its reason before execution.
- Prefer reversible operations. When deleting datapoints or configurations, export first using `ascii/ascii_export`.
- Batch writes of large numbers of datapoints should be planned in advance and reviewed.
- For structural changes (creating/deleting DP types), validate on a test system first.

## Operational Awareness

- Before writing to a datapoint, check its alarm configuration using `alarms/alarm_config_get` to understand impact.
- Check archiving configuration with `archive/archive_config_get` — changes to archived values are permanently recorded.
- For time-critical operations, use `datapoints/dp_set_timed` to schedule values precisely.

## Manager Operations

- Use `manager/manager_list` and `manager/manager_status` to understand system state before any manager action.
- Never stop the manager running this MCP server (the system will prevent self-stop).
- After stopping and starting a manager, verify its RunState using `manager/manager_status`.
- Allow adequate time between stop and start operations (restart default timeout: 10 seconds).

## Safety Principles

- In industrial systems, incorrect values can cause equipment damage or safety incidents.
- If uncertain about the effect of a write operation, consult the process engineer or SCADA administrator.
- Treat all SCADA systems as safety-critical unless explicitly told otherwise.
- When in doubt, read — do not write.
