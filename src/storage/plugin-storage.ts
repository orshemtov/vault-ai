import type { Plugin } from "obsidian";

export interface PluginStoredState<TSettings> {
  settings: TSettings;
  activeConversationPath: string | null;
  assistantState?: {
    providerId?: string;
    modelId?: string;
    agentId?: string;
  };
}

export class PluginStorage {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly plugin: Plugin) {}

  async load<T>(fallback: T): Promise<T> {
    const stored = (await this.plugin.loadData()) as unknown;

    if (isPluginStoredState(stored)) {
      return stored.settings as T;
    }

    return (stored as T | null) ?? fallback;
  }

  async save<T>(value: T): Promise<void> {
    await this.updateStoredState<T>((current) => ({
      settings: value,
      activeConversationPath: current.activeConversationPath,
      assistantState: current.assistantState
    }));
  }

  async loadActiveConversationPath(): Promise<string | null> {
    const stored =
      (await this.plugin.loadData()) as PluginStoredState<unknown> | null;
    return stored?.activeConversationPath ?? null;
  }

  async saveActiveConversationPath(path: string | null): Promise<void> {
    await this.updateStoredState((current) => ({
      settings: current.settings,
      activeConversationPath: path,
      assistantState: current.assistantState
    }));
  }

  async loadAssistantState(): Promise<
    PluginStoredState<unknown>["assistantState"]
  > {
    const stored =
      (await this.plugin.loadData()) as PluginStoredState<unknown> | null;
    return stored?.assistantState;
  }

  async saveAssistantState(state: {
    providerId?: string;
    modelId?: string;
    agentId?: string;
  }): Promise<void> {
    await this.updateStoredState((current) => ({
      settings: current.settings,
      activeConversationPath: current.activeConversationPath,
      assistantState: state
    }));
  }

  private async updateStoredState<T>(
    updater: (
      current: PluginStoredState<T | null>
    ) => PluginStoredState<T | null>
  ): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const current = normalizeStoredState<T>(
        (await this.plugin.loadData()) as PluginStoredState<T | null> | null
      );
      await this.plugin.saveData(updater(current));
    });

    await this.writeQueue;
  }
}

function isPluginStoredState(
  value: unknown
): value is PluginStoredState<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "settings" in value &&
    "activeConversationPath" in value
  );
}

function normalizeStoredState<T>(
  value: PluginStoredState<T | null> | null
): PluginStoredState<T | null> {
  return {
    settings: value?.settings ?? null,
    activeConversationPath: value?.activeConversationPath ?? null,
    assistantState: value?.assistantState
  };
}
