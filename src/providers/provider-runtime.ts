import type { OpenVaultAiPluginSettings, ProviderId } from "@app/settings";

export type ProviderSettingsSubset = Pick<
  OpenVaultAiPluginSettings,
  | "openRouterBaseUrl"
  | "openRouterApiKey"
  | "openAiBaseUrl"
  | "openAiApiKey"
  | "anthropicBaseUrl"
  | "anthropicApiKey"
  | "ollamaBaseUrl"
>;

export type ProviderCatalogStatus = "idle" | "loading" | "ready" | "error";

export interface ProviderCatalogSnapshot {
  providerId: ProviderId;
  status: ProviderCatalogStatus;
  models: ProviderCapabilityMetadata[];
  error: string | null;
  fetchedAt: number | null;
}

export interface ProviderCapabilityMetadata {
  providerId: ProviderId;
  modelId: string;
  displayName: string;
  isLocal: boolean;
  supportsGeneration: boolean;
  supportsEmbeddings: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  contextWindow: number | null;
  recommendedUses: string[];
}

export interface ProviderTextGenerationRequest {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface ProviderTextGenerationResponse {
  text: string;
}

export interface ProviderTextStreamCallbacks {
  onDelta: (delta: string) => void;
}

export interface ProviderTextStreamOptions {
  signal?: AbortSignal;
}

export const createEmptyProviderCatalogSnapshot = (
  providerId: ProviderId
): ProviderCatalogSnapshot => ({
  providerId,
  status: "idle",
  models: [],
  error: null,
  fetchedAt: null
});
