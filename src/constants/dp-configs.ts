/**
 * WinCC OA datapoint config type constants.
 *
 * These numeric values identify which config type is active on a DPE attribute.
 * Use these when reading or writing `:_archive.._type`, `:_alert_hdl.._type`,
 * `:_pv_range.._type`, etc.  Never inline as bare numbers in tool implementations.
 */

/** Disables any config type on a DPE attribute. */
export const DPCONFIG_NONE = 0;

/** _pv_range config type constant. */
export const DPCONFIG_PV_RANGE = 5;

/** _archive config type constant. */
export const DPCONFIG_ARCHIVE = 9;

/** Binary (_alert_hdl) alarm config type. */
export const DPCONFIG_ALERT_BINARYSIGNAL = 23;

/** Non-binary (_alert_hdl) alarm config type. */
export const DPCONFIG_ALERT_NONBINARYSIGNAL = 19;

/** _address config type constant (peripheral address). */
export const DPCONFIG_ADDRESS = 4;

/** _distrib config type constant. */
export const DPCONFIG_DISTRIB = 56;

/** _smooth config type constants. */
export const DPCONFIG_SMOOTH_STANDARD = 48;
export const DPCONFIG_SMOOTH_DERIVATIVE = 49;
export const DPCONFIG_SMOOTH_FLUTTER = 50;
