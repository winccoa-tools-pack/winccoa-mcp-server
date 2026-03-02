/**
 * Unit tests for dp-type-helpers utilities
 */

import { describe, it, expect } from "vitest";
import { WinccoaDpTypeNode, WinccoaElementType } from "winccoa-manager";
import {
  elementTypeName,
  validElementTypeNames,
  nodeToJson,
  jsonToNode,
} from "./dp-type-helpers.js";

describe("elementTypeName", () => {
  it("returns correct name for known element types", () => {
    expect(elementTypeName(WinccoaElementType.Float)).toBe("Float");
    expect(elementTypeName(WinccoaElementType.Bool)).toBe("Bool");
    expect(elementTypeName(WinccoaElementType.Int)).toBe("Int");
    expect(elementTypeName(WinccoaElementType.String)).toBe("String");
    expect(elementTypeName(WinccoaElementType.Struct)).toBe("Struct");
    expect(elementTypeName(WinccoaElementType.Typeref)).toBe("Typeref");
  });

  it("returns Unknown(n) for unknown element type values", () => {
    expect(elementTypeName(9999)).toBe("Unknown(9999)");
    expect(elementTypeName(0)).toBe("Unknown(0)");
  });

  it("returns correct name for dynamic types", () => {
    expect(elementTypeName(WinccoaElementType.DynFloat)).toBe("DynFloat");
    expect(elementTypeName(WinccoaElementType.DynString)).toBe("DynString");
    expect(elementTypeName(WinccoaElementType.DynBool)).toBe("DynBool");
  });
});

describe("validElementTypeNames", () => {
  it("returns an array of strings", () => {
    const names = validElementTypeNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
  });

  it("includes expected type names", () => {
    const names = validElementTypeNames();
    expect(names).toContain("Float");
    expect(names).toContain("Bool");
    expect(names).toContain("Int");
    expect(names).toContain("String");
    expect(names).toContain("Struct");
    expect(names).toContain("Typeref");
    expect(names).toContain("DynFloat");
  });
});

describe("nodeToJson", () => {
  it("converts a simple leaf node to JSON", () => {
    const node = new WinccoaDpTypeNode("level", WinccoaElementType.Float);
    const json = nodeToJson(node);

    expect(json.name).toBe("level");
    expect(json.elementType).toBe(WinccoaElementType.Float);
    expect(json.elementTypeName).toBe("Float");
    expect(json.children).toBeUndefined();
    expect(json.refName).toBeUndefined();
  });

  it("includes refName when present", () => {
    const node = new WinccoaDpTypeNode("ref", WinccoaElementType.Typeref, "MyOtherType");
    const json = nodeToJson(node);

    expect(json.refName).toBe("MyOtherType");
  });

  it("omits refName when it is empty string", () => {
    const node = new WinccoaDpTypeNode("level", WinccoaElementType.Float, "");
    const json = nodeToJson(node);

    expect(json.refName).toBeUndefined();
  });

  it("recursively converts children", () => {
    const child1 = new WinccoaDpTypeNode("value", WinccoaElementType.Float);
    const child2 = new WinccoaDpTypeNode("status", WinccoaElementType.Bool);
    const parent = new WinccoaDpTypeNode("sensor", WinccoaElementType.Struct, "", [child1, child2]);

    const json = nodeToJson(parent);

    expect(json.children).toHaveLength(2);
    expect(json.children![0]!.name).toBe("value");
    expect(json.children![0]!.elementTypeName).toBe("Float");
    expect(json.children![1]!.name).toBe("status");
    expect(json.children![1]!.elementTypeName).toBe("Bool");
  });

  it("omits children when the node has no children", () => {
    const node = new WinccoaDpTypeNode("level", WinccoaElementType.Float, "", []);
    const json = nodeToJson(node);

    expect(json.children).toBeUndefined();
  });
});

describe("jsonToNode", () => {
  it("converts a simple input to WinccoaDpTypeNode", () => {
    const node = jsonToNode({ name: "level", elementTypeName: "Float" });

    expect(node).toBeInstanceOf(WinccoaDpTypeNode);
    expect(node.name).toBe("level");
    expect(node.elementType).toBe(WinccoaElementType.Float);
  });

  it("throws on unknown elementTypeName", () => {
    expect(() => jsonToNode({ name: "x", elementTypeName: "UnknownType" })).toThrow(
      /Unknown elementTypeName/,
    );
  });

  it("sets refName for Typeref nodes", () => {
    const node = jsonToNode({ name: "ref", elementTypeName: "Typeref", refName: "OtherType" });

    expect(node.elementType).toBe(WinccoaElementType.Typeref);
    expect(node.refName).toBe("OtherType");
  });

  it("recursively converts children", () => {
    const node = jsonToNode({
      name: "sensor",
      elementTypeName: "Struct",
      children: [
        { name: "value", elementTypeName: "Float" },
        { name: "status", elementTypeName: "Bool" },
      ],
    });

    expect(node.children).toHaveLength(2);
    expect(node.children[0]!.name).toBe("value");
    expect(node.children[0]!.elementType).toBe(WinccoaElementType.Float);
    expect(node.children[1]!.name).toBe("status");
    expect(node.children[1]!.elementType).toBe(WinccoaElementType.Bool);
  });

  it("returns empty children array when none provided", () => {
    const node = jsonToNode({ name: "level", elementTypeName: "Float" });
    expect(node.children).toEqual([]);
  });

  it("handles newName field for dpTypeChange operations", () => {
    const node = jsonToNode({ name: "oldName", elementTypeName: "Float", newName: "newName" });
    expect(node.newName).toBe("newName");
  });
});

describe("nodeToJson / jsonToNode round-trip", () => {
  it("preserves scalar node data through round-trip", () => {
    const input = { name: "level", elementTypeName: "Float" };
    const roundTripped = nodeToJson(jsonToNode(input));

    expect(roundTripped.name).toBe(input.name);
    expect(roundTripped.elementTypeName).toBe("Float");
    expect(roundTripped.elementType).toBe(WinccoaElementType.Float);
  });

  it("preserves struct with children through round-trip", () => {
    const input = {
      name: "sensor",
      elementTypeName: "Struct",
      children: [
        { name: "value", elementTypeName: "Float" },
        { name: "enabled", elementTypeName: "Bool" },
      ],
    };

    const node = jsonToNode(input);
    const json = nodeToJson(node);

    expect(json.name).toBe("sensor");
    expect(json.elementTypeName).toBe("Struct");
    expect(json.children).toHaveLength(2);
    expect(json.children![0]!.elementTypeName).toBe("Float");
    expect(json.children![1]!.elementTypeName).toBe("Bool");
  });
});
