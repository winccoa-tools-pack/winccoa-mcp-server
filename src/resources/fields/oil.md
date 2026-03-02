# Oil & Gas SCADA Safety Guidelines

These guidelines apply in oil & gas environments, where process safety and regulatory compliance are paramount.

## Safety-Critical Systems — Read Only

- **Assume all systems are safety-critical unless explicitly designated as non-critical.**
- Emergency Shutdown (ESD/SIS), Fire & Gas (F&G), and High-Integrity Protection Systems (HIPS) must never be written to via automated tooling without a formal Management of Change (MoC) process.
- Read-only monitoring of safety system states is acceptable. Writes are not.

## Operational Limits and Setpoints

- Before modifying any process setpoint (pressure, temperature, flow, level), verify the engineering limits and HAZOP documentation.
- Always check current process values against alarm high/high-high and low/low-low limits before writing new setpoints.
- Setpoint changes should be within ±10% of the current operating point unless a formal change request is in place.
- Use `pv_range/pv_range_get` to confirm the valid operating range before any write.

## Regulatory Compliance

- All changes to SIL-rated (Safety Integrity Level) instruments or control loops require signed-off MoC documentation.
- Alarm changes for safety functions are subject to IEC 61511 / IEC 61508 change control.
- Audit trails are mandatory: use `alarms/alarm_log_get` and archive queries to verify before-state.

## Hydrocarbons and Hazardous Materials

- Datapoints controlling hydrocarbon isolation valves or emergency deluge systems are prohibited from automated writes.
- Loss-of-containment scenarios (valve open/close on hydrocarbon lines) must go through a permit-to-work system.

## General

- Maintain a change log including timestamp, value before and after, operator name, and reason.
- Validate all changes against the current PID (Piping & Instrumentation Diagram) version.
- In case of any doubt, stop and consult the control room supervisor.
