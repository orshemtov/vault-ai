import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn()
}));

import { requestUrl } from "obsidian";

import { OpenAiAdapter } from "./openai-adapter";

describe("OpenAiAdapter", () => {
  const adapter = new OpenAiAdapter();

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
    ).rejects.toThrow("OpenAI API key is not configured.");
  });

  it("extracts assistant text from a chat completion", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      json: {
        choices: [{ message: { content: "Hello from OpenAI" } }]
      },
      text: ""
    } as never);

    const result = await adapter.generateText(
      {
        modelId: "gpt-4.1",
        systemPrompt: "You are helpful.",
        userPrompt: "Hi"
      },
      {
        openRouterBaseUrl: "https://openrouter.ai/api/v1",
        openRouterApiKey: "",
        openAiBaseUrl: "https://api.openai.com/v1",
        openAiApiKey: "sk-test",
        anthropicBaseUrl: "https://api.anthropic.com",
        anthropicApiKey: "",
        ollamaBaseUrl: "http://127.0.0.1:11434"
      }
    );

    expect(result.text).toBe("Hello from OpenAI");
  });

  it("streams assistant text from SSE chunks", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" from OpenAI"}}]}\n\n',
        "data: [DONE]\n\n"
      ].join("")
    } as never);

    const deltas: string[] = [];
    const result = await adapter.streamText(
      {
        modelId: "gpt-4.1",
        systemPrompt: "You are helpful.",
        userPrompt: "Hi"
      },
      {
        openRouterBaseUrl: "https://openrouter.ai/api/v1",
        openRouterApiKey: "",
        openAiBaseUrl: "https://api.openai.com/v1",
        openAiApiKey: "sk-test",
        anthropicBaseUrl: "https://api.anthropic.com",
        anthropicApiKey: "",
        ollamaBaseUrl: "http://127.0.0.1:11434"
      },
      {
        onDelta: (delta) => deltas.push(delta)
      }
    );

    expect(deltas).toEqual(["Hello", " from OpenAI"]);
    expect(result.text).toBe("Hello from OpenAI");
  });
});
