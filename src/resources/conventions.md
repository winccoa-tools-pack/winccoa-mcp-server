# WinCC OA Naming Conventions

## Datapoint Names

- Must start with a letter or underscore
- May only contain letters, digits, and underscores
- Maximum 128 characters
- Case-sensitive
- System prefix: `System1:DpName` (colon separator)

## Datapoint Element Names

- dot-separated path from DP root: `DpName.Element.SubElement`
- Trailing dot indicates root element read: `DpName.`
- Config attributes: `DpName.:_archive.._type`

## Datapoint Type Names

- Same character rules as DP names
- Types provided by WinCC OA start with underscore: `_pmon_Manager`
- User types should NOT start with underscore

## Archive Class Names

Common predefined archive classes:
- `_NGA_G_EVENT` — archive on value change (event-driven)
- `_NGA_G_1S`    — 1-second interval
- `_NGA_G_1M`    — 1-minute interval
- `_NGA_G_1H`    — 1-hour interval

## Alert Class Names

Alert class names are project-specific. Query them via:
`datapoints/dp_names` with `dpType = "_AlertHdl"` or similar project configuration.

## Unit Strings

Use standard SI unit abbreviations where possible:
`"°C"`, `"bar"`, `"m/s"`, `"kW"`, `"V"`, `"A"`, `"Hz"`

## Language Codes

Language codes used in multi-language strings:
- `"en_US"` — English (US)
- `"de_DE"` — German
- `"fr_FR"` — French
- `"zh_CN"` — Chinese (Simplified)

Use `manager/system_info` → `projectLangs` to find configured project languages.
