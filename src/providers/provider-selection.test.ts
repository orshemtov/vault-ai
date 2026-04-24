import type { ProviderCatalogSnapshot } from "./provider-runtime";
import {
  findExactGenerationModel,
  getFirstGenerationModelForProvider,
  getGenerationModelsForProvider,
  listGenerationModels,
  resolveProviderScopedModel
} from "./provider-selection";

const catalogs: ProviderCatalogSnapshot[] = [
  {
    providerId: "openrouter",
    status: "ready",
    error: null,
    fetchedAt: Date.now(),
    models: [
      {
        providerId: "openrouter",
        modelId: "openai/gpt-5.4",
        displayName: "GPT-5.4",
        isLocal: false,
        supportsGeneration: true,
        supportsEmbeddings: false,
        supportsStreaming: true,
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        contextWindow: null,
        recommendedUses: ["chat"]
      },
      {
        providerId: "openrouter",
        modelId: "text-embedding-3-small",
        displayName: "Embedding",
        isLocal: false,
        supportsGeneration: false,
        supportsEmbeddings: true,
        supportsStreaming: false,
        supportsToolCalling: false,
        supportsStructuredOutput: false,
        contextWindow: null,
        recommendedUses: ["embeddings"]
      }
    ]
  },
  {
    providerId: "openai",
    status: "ready",
    error: null,
    fetchedAt: Date.now(),
    models: [
      {
        providerId: "openai",
        modelId: "gpt-5.4",
        displayName: "gpt-5.4",
        isLocal: false,
        supportsGeneration: true,
        supportsEmbeddings: false,
        supportsStreaming: true,
        supportsToolCalling: false,
        supportsStructuredOutput: false,
        contextWindow: null,
        recommendedUses: ["chat"]
      }
    ]
  }
];

describe("provider selection", () => {
  it("lists only generation-capable models", () => {
    expect(
      listGenerationModels(catalogs).map((model) => model.modelId)
    ).toEqual(["openai/gpt-5.4", "gpt-5.4"]);
  });

  it("finds an exact provider/model match", () => {
    expect(
      findExactGenerationModel(catalogs, {
        providerId: "openrouter",
        modelId: "openai/gpt-5.4"
      })
    ).toEqual({
      providerId: "openrouter",
      modelId: "openai/gpt-5.4"
    });
  });

  it("falls back to a unique global model match when provider differs", () => {
    expect(
      findExactGenerationModel(catalogs, {
        providerId: "openrouter",
        modelId: "gpt-5.4"
      })
    ).toEqual({
      providerId: "openai",
      modelId: "gpt-5.4"
    });
  });

  it("returns the first generation model for a provider", () => {
    expect(getFirstGenerationModelForProvider(catalogs, "openai")).toEqual({
      providerId: "openai",
      modelId: "gpt-5.4"
    });
  });

  it("filters generation models by provider", () => {
    expect(
      getGenerationModelsForProvider(catalogs, "openai").map(
        (model) => model.modelId
      )
    ).toEqual(["gpt-5.4"]);
  });

  it("falls back to the provider's own first model for stale cross-provider settings", () => {
    expect(
      resolveProviderScopedModel(catalogs, "openai", "openai/gpt-5.4")
    ).toEqual({
      providerId: "openai",
      modelId: "gpt-5.4"
    });
  });
});
