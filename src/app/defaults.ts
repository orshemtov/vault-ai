export const SUPPORTED_PROVIDERS = [
  "openrouter",
  "ollama",
  "openai",
  "anthropic"
] as const;

export const DEFAULT_PROVIDER = "openrouter" as const;
export const DEFAULT_AGENT = "ask";
export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4";

export const DEFAULT_PROVIDER_URLS = {
  openRouterBaseUrl: "https://openrouter.ai/api/v1",
  openAiBaseUrl: "https://api.openai.com/v1",
  anthropicBaseUrl: "https://api.anthropic.com",
  ollamaBaseUrl: "http://127.0.0.1:11434"
} as const;

export const DEFAULT_VAULT_ROOTS = {
  agentsRoot: "AI/Agents",
  skillsRoot: "AI/Skills",
  commandsRoot: "AI/Commands",
  conversationsRoot: "AI/Conversations",
  memoryRoot: "AI/Memory"
} as const;

export const DEFAULT_ADVANCED_SETTINGS = {
  enableDebugLogging: false,
  enableIndexingOnStartup: true
} as const;
