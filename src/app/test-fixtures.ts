import { DEFAULT_SETTINGS, type VaultAiPluginSettings } from "./settings";

export function createTestSettings(
  overrides: Partial<VaultAiPluginSettings> = {}
): VaultAiPluginSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides
  };
}
