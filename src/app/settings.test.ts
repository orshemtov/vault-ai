import { DEFAULT_SETTINGS, pluginSettingsSchema } from "./settings";

describe("pluginSettingsSchema", () => {
  it("accepts the default settings", () => {
    expect(pluginSettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(
      DEFAULT_SETTINGS
    );
  });

  it("requires a conversations root", () => {
    expect(DEFAULT_SETTINGS.conversationsRoot).toBe("AI/Conversations");
  });

  it("requires a commands root", () => {
    expect(DEFAULT_SETTINGS.commandsRoot).toBe("Commands");
  });

  it("requires a memory root", () => {
    expect(DEFAULT_SETTINGS.memoryRoot).toBe("AI/Memory");
  });

  it("keeps a valid default provider and model pair", () => {
    expect(DEFAULT_SETTINGS.defaultProvider).toBe("openrouter");
    expect(DEFAULT_SETTINGS.defaultChatModel).toBe("openai/gpt-5.4");
  });

  it("accepts openai and anthropic provider ids", () => {
    const parsed = pluginSettingsSchema.parse({
      ...DEFAULT_SETTINGS,
      defaultProvider: "anthropic",
      openAiBaseUrl: "https://api.openai.com/v1",
      openAiApiKey: "",
      anthropicBaseUrl: "https://api.anthropic.com",
      anthropicApiKey: ""
    });

    expect(parsed.defaultProvider).toBe("anthropic");
  });
});
