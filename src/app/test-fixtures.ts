import { DEFAULT_SETTINGS, type OpenVaultAiPluginSettings } from "./settings";

export function createTestSettings(
  overrides: Partial<OpenVaultAiPluginSettings> = {}
): OpenVaultAiPluginSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides
  };
}
