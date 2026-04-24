import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn()
}));

import { requestUrl } from "obsidian";

import { AnthropicAdapter } from "./anthropic-adapter";

describe("AnthropicAdapter", () => {
  const adapter = new AnthropicAdapter();

  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it("throws when the API key is missing", async () => {
    await expect(
      adapter.listModels({
        openRouterBaseUrl: "https://openrouter.ai/api/v1",
        openRouterApiKey: "",
        openAiBaseUrl: "https://api.openai.com/v1",
        openAiApiKey: "",
        anthropicBaseUrl: "https://api.anthropic.com",
        anthropicApiKey: "",
        ollamaBaseUrl: "http://127.0.0.1:11434"
      })
    ).rejects.toThrow("Anthropic API key is not configured.");
  });

  it("extracts text blocks from a messages response", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      json: {
        content: [{ type: "text", text: "Hello from Anthropic" }]
      },
      text: ""
    } as never);

    const result = await adapter.generateText(
      {
        modelId: "claude-3-5-sonnet-latest",
        systemPrompt: "You are helpful.",
        userPrompt: "Hi"
      },
      {
        openRouterBaseUrl: "https://openrouter.ai/api/v1",
        openRouterApiKey: "",
        openAiBaseUrl: "https://api.openai.com/v1",
        openAiApiKey: "",
        anthropicBaseUrl: "https://api.anthropic.com",
        anthropicApiKey: "sk-ant-test",
        ollamaBaseUrl: "http://127.0.0.1:11434"
      }
    );

    expect(result.text).toBe("Hello from Anthropic");
  });

  it("streams text deltas from SSE chunks", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: [
        'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":" from Anthropic"}}\n\n'
      ].join("")
    } as never);

    const deltas: string[] = [];
    const result = await adapter.streamText(
      {
        modelId: "claude-3-5-sonnet-latest",
        systemPrompt: "You are helpful.",
        userPrompt: "Hi"
      },
      {
        openRouterBaseUrl: "https://openrouter.ai/api/v1",
        openRouterApiKey: "",
        openAiBaseUrl: "https://api.openai.com/v1",
        openAiApiKey: "",
        anthropicBaseUrl: "https://api.anthropic.com",
        anthropicApiKey: "sk-ant-test",
        ollamaBaseUrl: "http://127.0.0.1:11434"
      },
      {
        onDelta: (delta) => deltas.push(delta)
      }
    );

    expect(deltas).toEqual(["Hello", " from Anthropic"]);
    expect(result.text).toBe("Hello from Anthropic");
  });
});
