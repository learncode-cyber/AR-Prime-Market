import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "@/lib/plugins/registry";

interface FakePlugin {
  id: string;
  label: string;
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry<FakePlugin>;

  beforeEach(() => {
    registry = new PluginRegistry<FakePlugin>();
  });

  it("registers and retrieves a plugin by id", () => {
    registry.register({ id: "a", label: "Plugin A" });
    expect(registry.get("a")?.label).toBe("Plugin A");
  });

  it("returns undefined for an unregistered id via get()", () => {
    expect(registry.get("missing")).toBeUndefined();
  });

  it("require() throws a descriptive error for an unregistered id", () => {
    registry.register({ id: "a", label: "Plugin A" });
    expect(() => registry.require("missing")).toThrow(/No plugin registered with id "missing"/);
    expect(() => registry.require("missing")).toThrow(/Registered: \[a\]/);
  });

  it("require() returns the plugin when it exists", () => {
    registry.register({ id: "a", label: "Plugin A" });
    expect(registry.require("a").label).toBe("Plugin A");
  });

  it("rejects registering a duplicate id by default", () => {
    registry.register({ id: "a", label: "First" });
    expect(() => registry.register({ id: "a", label: "Second" })).toThrow(/already registered/);
    expect(registry.get("a")?.label).toBe("First");
  });

  it("allows overriding a duplicate id when explicitly permitted", () => {
    registry.register({ id: "a", label: "First" });
    registry.register({ id: "a", label: "Second" }, { allowOverride: true });
    expect(registry.get("a")?.label).toBe("Second");
  });

  it("rejects a plugin with an empty id", () => {
    expect(() => registry.register({ id: "", label: "Bad" })).toThrow(/non-empty id/);
  });

  it("the first registered plugin becomes the default automatically", () => {
    registry.register({ id: "a", label: "First" });
    registry.register({ id: "b", label: "Second" });
    expect(registry.getDefault()?.id).toBe("a");
  });

  it("setDefault:true on registration overrides the automatic default", () => {
    registry.register({ id: "a", label: "First" });
    registry.register({ id: "b", label: "Second" }, { setDefault: true });
    expect(registry.getDefault()?.id).toBe("b");
  });

  it("setDefault() changes the default to an already-registered plugin", () => {
    registry.register({ id: "a", label: "First" });
    registry.register({ id: "b", label: "Second" });
    registry.setDefault("b");
    expect(registry.getDefault()?.id).toBe("b");
  });

  it("setDefault() throws for an unregistered id", () => {
    expect(() => registry.setDefault("nope")).toThrow(/no plugin registered/);
  });

  it("has() correctly reports registration status", () => {
    registry.register({ id: "a", label: "First" });
    expect(registry.has("a")).toBe(true);
    expect(registry.has("b")).toBe(false);
  });

  it("list() returns all registered plugins", () => {
    registry.register({ id: "a", label: "First" });
    registry.register({ id: "b", label: "Second" });
    expect(
      registry
        .list()
        .map((p) => p.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("clear() empties the registry and resets the default", () => {
    registry.register({ id: "a", label: "First" });
    registry.clear();
    expect(registry.list()).toEqual([]);
    expect(registry.getDefault()).toBeUndefined();
  });
});
