import {
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_AGENT,
  DEFAULT_CHAT_MODEL,
  DEFAULT_PROVIDER,
  DEFAULT_PROVIDER_URLS,
  DEFAULT_VAULT_ROOTS,
  SUPPORTED_PROVIDERS
} from "./defaults";
import { z } from "zod";

export const providerIdSchema = z.enum(SUPPORTED_PROVIDERS);

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
  defaultProvider: DEFAULT_PROVIDER,
  defaultAgent: DEFAULT_AGENT,
  defaultChatModel: DEFAULT_CHAT_MODEL,
  openRouterBaseUrl: DEFAULT_PROVIDER_URLS.openRouterBaseUrl,
  openRouterApiKey: "",
  openAiBaseUrl: DEFAULT_PROVIDER_URLS.openAiBaseUrl,
  openAiApiKey: "",
  anthropicBaseUrl: DEFAULT_PROVIDER_URLS.anthropicBaseUrl,
  anthropicApiKey: "",
  ollamaBaseUrl: DEFAULT_PROVIDER_URLS.ollamaBaseUrl,
  agentsRoot: DEFAULT_VAULT_ROOTS.agentsRoot,
  skillsRoot: DEFAULT_VAULT_ROOTS.skillsRoot,
  commandsRoot: DEFAULT_VAULT_ROOTS.commandsRoot,
  conversationsRoot: DEFAULT_VAULT_ROOTS.conversationsRoot,
  memoryRoot: DEFAULT_VAULT_ROOTS.memoryRoot,
  enableDebugLogging: DEFAULT_ADVANCED_SETTINGS.enableDebugLogging,
  enableIndexingOnStartup: DEFAULT_ADVANCED_SETTINGS.enableIndexingOnStartup
};
