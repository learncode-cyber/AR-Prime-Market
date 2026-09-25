/**
 * A minimal, generic plugin registry. Used for every plugin category
 * (AI providers today; suppliers/payments once their edge functions are
 * migrated — see docs/architecture/PLUGIN_SYSTEM.md).
 */

export interface RegistrablePlugin {
  readonly id: string;
}

export class PluginRegistry<T extends RegistrablePlugin> {
  private plugins = new Map<string, T>();
  private defaultId: string | null = null;

  /**
   * @param options.allowOverride — if false (default), registering a
   *   duplicate id throws. Set true only in tests/hot-reload scenarios.
   */
  register(plugin: T, options: { allowOverride?: boolean; setDefault?: boolean } = {}): void {
    if (!plugin.id || !plugin.id.trim()) {
      throw new Error("Plugin must have a non-empty id");
    }
    if (this.plugins.has(plugin.id) && !options.allowOverride) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
    if (options.setDefault || this.defaultId === null) {
      this.defaultId = plugin.id;
    }
  }

  get(id: string): T | undefined {
    return this.plugins.get(id);
  }

  require(id: string): T {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new Error(
        `No plugin registered with id "${id}". Registered: [${this.list()
          .map((p) => p.id)
          .join(", ")}]`,
      );
    }
    return plugin;
  }

  getDefault(): T | undefined {
    return this.defaultId ? this.plugins.get(this.defaultId) : undefined;
  }

  setDefault(id: string): void {
    if (!this.plugins.has(id)) {
      throw new Error(`Cannot set default: no plugin registered with id "${id}"`);
    }
    this.defaultId = id;
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  list(): T[] {
    return Array.from(this.plugins.values());
  }

  /** Test/ops helper — not typically needed in application code. */
  clear(): void {
    this.plugins.clear();
    this.defaultId = null;
  }
}
