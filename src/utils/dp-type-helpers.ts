/**
 * Shared helpers for converting between WinccoaDpTypeNode (native) and
 * plain JSON-serialisable objects used in MCP tool inputs / outputs.
 */

import { WinccoaDpTypeNode, WinccoaElementType } from "winccoa-manager";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Plain-object representation of a DPT node (used in tool output). */
export interface DpTypeNodeJson {
  name: string;
  elementType: number;
  elementTypeName: string;
  refName?: string;
  children?: DpTypeNodeJson[];
}

/** Plain-object tree accepted as input by create / change tools. */
export interface DpTypeNodeInput {
  name: string;
  /** Human-readable element type name, e.g. "Struct", "Float", "Typeref". */
  elementTypeName: string;
  /** Required when elementTypeName is "Typeref". */
  refName?: string;
  /** Used by dpTypeChange to rename an element. */
  newName?: string;
  children?: DpTypeNodeInput[];
}

// ---------------------------------------------------------------------------
// Name ↔ enum mapping
// ---------------------------------------------------------------------------

const TYPE_NAME_TO_ENUM: Record<string, WinccoaElementType> = {
  Struct:       WinccoaElementType.Struct,
  Bool:         WinccoaElementType.Bool,
  Int:          WinccoaElementType.Int,
  UInt:         WinccoaElementType.UInt,
  Long:         WinccoaElementType.Long,
  ULong:        WinccoaElementType.ULong,
  Float:        WinccoaElementType.Float,
  String:       WinccoaElementType.String,
  Time:         WinccoaElementType.Time,
  Bit32:        WinccoaElementType.Bit32,
  Blob:         WinccoaElementType.Blob,
  LangString:   WinccoaElementType.LangString,
  DynBool:      WinccoaElementType.DynBool,
  DynInt:       WinccoaElementType.DynInt,
  DynUInt:      WinccoaElementType.DynUInt,
  DynLong:      WinccoaElementType.DynLong,
  DynULong:     WinccoaElementType.DynULong,
  DynFloat:     WinccoaElementType.DynFloat,
  DynString:    WinccoaElementType.DynString,
  DynTime:      WinccoaElementType.DynTime,
  DynBit32:     WinccoaElementType.DynBit32,
  DynBlob:      WinccoaElementType.DynBlob,
  DynLangString: WinccoaElementType.DynLangString,
  Typeref:      WinccoaElementType.Typeref,
};

const TYPE_ENUM_TO_NAME: Map<number, string> = new Map(
  Object.entries(TYPE_NAME_TO_ENUM).map(([name, value]) => [value as number, name]),
);

/** Returns the human-readable name for a WinccoaElementType value. */
export function elementTypeName(elementType: number): string {
  return TYPE_ENUM_TO_NAME.get(elementType) ?? `Unknown(${elementType})`;
}

/** Returns the valid element type name strings for use in descriptions. */
export function validElementTypeNames(): string[] {
  return Object.keys(TYPE_NAME_TO_ENUM);
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/**
 * Recursively converts a native WinccoaDpTypeNode into a plain JSON object.
 * Adds a human-readable `elementTypeName` in addition to the numeric `elementType`.
 */
export function nodeToJson(node: WinccoaDpTypeNode): DpTypeNodeJson {
  // The real WinccoaDpTypeNode JS class stores the element type as `.type`,
  // while the TypeScript declaration and mock use `.elementType`.
  // Read from both to support both the real native add-on and the unit-test mock.
  const raw = node as unknown as Record<string, number>;
  const et = (raw["type"] ?? raw["elementType"] ?? 0) as WinccoaElementType;

  const result: DpTypeNodeJson = {
    name: node.name,
    elementType: et,
    elementTypeName: elementTypeName(et),
  };

  if (node.refName) {
    result.refName = node.refName;
  }

  if (node.children && node.children.length > 0) {
    result.children = node.children.map(nodeToJson);
  }

  return result;
}

/**
 * Recursively converts a plain input object into WinccoaDpTypeNode instances.
 * Throws a descriptive error for unknown elementTypeName values.
 */
export function jsonToNode(input: DpTypeNodeInput): WinccoaDpTypeNode {
  const elementType = TYPE_NAME_TO_ENUM[input.elementTypeName];
  if (elementType === undefined) {
    throw new Error(
      `Unknown elementTypeName "${input.elementTypeName}". ` +
      `Valid values: ${validElementTypeNames().join(", ")}`,
    );
  }

  const children: WinccoaDpTypeNode[] =
    input.children?.map(jsonToNode) ?? [];

  const node = new WinccoaDpTypeNode(
    input.name,
    elementType,
    input.refName,
    children,
    input.newName,
  );

  // The real WinccoaDpTypeNode JS class stores element type as `.type` (set by the
  // constructor above), but the C++ native binding for dpTypeCreate may read `.elementType`.
  // Set both so the native add-on works regardless of which property name it reads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (node as any).elementType = elementType;

  return node;
}
