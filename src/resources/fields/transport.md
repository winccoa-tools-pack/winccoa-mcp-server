# Transportation SCADA Safety Guidelines

These guidelines apply in transportation environments (rail, road, metro, airport), where signal integrity and sequencing safety are critical.

## Signal Interlocking

- **Never write to interlocking datapoints directly** — interlocking logic must flow through the control system, not from MCP tools.
- Signal state changes must be requested through the proper operator workflow; never bypass interlocking by setting output DPs directly.
- Verify that the interlocking system is in the correct state before any track-side or platform operations.

## Sequencing Safety

- Operations must follow defined sequences. Do not skip steps or reverse sequence without explicit authority.
- Before any track section activation, verify all upstream sections are in the required state.
- Route-setting operations require confirmation that conflicting routes are released.

## Protocol Awareness

- Signalling datapoints may have tight timing requirements. Use `datapoints/dp_set_timed` for time-stamped writes when protocol demands.
- Real-time status DPs (track occupancy, signal aspects) must be treated as read-only monitoring data unless you are the designated control system.
- Do not write to communication gateway DPs (e.g., SCADA-to-PLC interface) without understanding the downstream protocol effect.

## Operational Restrictions

- Do not modify signal aspect datapoints during active traffic periods.
- Platform screen door (PSD) and automatic train protection (ATP) system DPs are read-only.
- Maintenance windows must be declared before any write to track-side equipment control DPs.

## Safety Verification

- After any setpoint or configuration change, verify the system response using `datapoints/dp_get` before proceeding.
- Monitor alarm state using `alarms/alarm_log_get` after changes to confirm no unexpected alarms triggered.
- All automated actions must be logged with a timestamp, DP name, old value, new value, and reason.

## General

- Transportation SCADA systems affect public safety. When uncertain, do not act — consult the signalling engineer.
- Emergency stop and fail-safe states take precedence over any automated action.
