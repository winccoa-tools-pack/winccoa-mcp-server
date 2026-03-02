/**
 * Shared type-guard utilities for WinCC OA element type checking.
 *
 * These guards are used by tools that must validate the element type of a DPE
 * before performing type-sensitive operations (e.g. PV range, non-binary alarm).
 */

import { WinccoaElementType } from "winccoa-manager";

/**
 * Numeric WinCC OA element types (scalar and dynamic variants).
 * Used to validate DPEs before writing numeric configs such as _pv_range.
 */
const NUMERIC_ELEMENT_TYPES = new Set<WinccoaElementType>([
  WinccoaElementType.Int,
  WinccoaElementType.UInt,
  WinccoaElementType.Long,
  WinccoaElementType.ULong,
  WinccoaElementType.Float,
  WinccoaElementType.DynInt,
  WinccoaElementType.DynUInt,
  WinccoaElementType.DynLong,
  WinccoaElementType.DynULong,
  WinccoaElementType.DynFloat,
]);

/**
 * Returns true when the given element type is a numeric type for which
 * PV range and non-binary alarm configurations are valid.
 */
export function isNumericElementType(elementType: WinccoaElementType): boolean {
  return NUMERIC_ELEMENT_TYPES.has(elementType);
}

/**
 * Returns true when the given element type is a boolean type for which
 * binary alarm configurations are valid.
 */
export function isBooleanElementType(elementType: WinccoaElementType): boolean {
  return elementType === WinccoaElementType.Bool || elementType === WinccoaElementType.DynBool;
}
