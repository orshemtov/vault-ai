import type { CommandDefinition } from "../commands/command-types";
import type { ProviderCatalogSnapshot } from "@providers/provider-runtime";
import { resolveRuntimeModelSelection } from "@providers/runtime-model-selection";

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

describe("resolveRuntimeModelSelection", () => {
  it("keeps the current selection when no command override exists", () => {
    expect(
      resolveRuntimeModelSelection(catalogs, "openrouter", "openai/gpt-5.4")
    ).toEqual({
      providerId: "openrouter",
      modelId: "openai/gpt-5.4"
    });
  });

  it("switches provider when a command model uniquely belongs elsewhere", () => {
    const command: CommandDefinition = {
      id: "summarize",
      description: "Summarize",
      template: "Summarize $ARGUMENTS",
      model: "gpt-5.4",
      source: "vault"
    };

    expect(
      resolveRuntimeModelSelection(
        catalogs,
        "openrouter",
        "openai/gpt-5.4",
        command
      )
    ).toEqual({
      providerId: "openai",
      modelId: "gpt-5.4"
    });
  });

  it("switches to the provider default generation model for provider-only commands", () => {
    const command: CommandDefinition = {
      id: "local",
      description: "Use local",
      template: "Answer locally",
      provider: "openai",
      source: "vault"
    };

    expect(
      resolveRuntimeModelSelection(
        catalogs,
        "openrouter",
        "openai/gpt-5.4",
        command
      )
    ).toEqual({
      providerId: "openai",
      modelId: "gpt-5.4"
    });
  });
});
