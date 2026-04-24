import { z } from "zod";

export const providerIdSchema = z.enum([
  "openrouter",
  "ollama",
  "openai",
  "anthropic"
]);

export const pluginSettingsSchema = z.object({
  defaultProvider: providerIdSchema,
  defaultAgent: z.string().min(1),
  defaultChatModel: z.string(),
  openRouterBaseUrl: z.string().url(),
  openRouterApiKey: z.string(),
  openAiBaseUrl: z.string().url(),
  openAiApiKey: z.string(),
  anthropicBaseUrl: z.string().url(),
  anthropicApiKey: z.string(),
  ollamaBaseUrl: z.string().url(),
  agentsRoot: z.string().min(1),
  skillsRoot: z.string().min(1),
  commandsRoot: z.string().min(1),
  conversationsRoot: z.string().min(1),
  memoryRoot: z.string().min(1),
  enableDebugLogging: z.boolean(),
  enableIndexingOnStartup: z.boolean()
});

export type ProviderId = z.infer<typeof providerIdSchema>;
export type VaultAiPluginSettings = z.infer<typeof pluginSettingsSchema>;

export const DEFAULT_SETTINGS: VaultAiPluginSettings = {
  defaultProvider: "openrouter",
  defaultAgent: "ask",
  defaultChatModel: "openai/gpt-5.4",
  openRouterBaseUrl: "https://openrouter.ai/api/v1",
  openRouterApiKey: "",
  openAiBaseUrl: "https://api.openai.com/v1",
  openAiApiKey: "",
  anthropicBaseUrl: "https://api.anthropic.com",
  anthropicApiKey: "",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  agentsRoot: "Agents",
  skillsRoot: "Skills",
  commandsRoot: "Commands",
  conversationsRoot: "AI/Conversations",
  memoryRoot: "AI/Memory",
  enableDebugLogging: false,
  enableIndexingOnStartup: true
};
