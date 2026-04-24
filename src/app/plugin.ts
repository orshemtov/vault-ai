import {
  DEFAULT_SETTINGS,
  pluginSettingsSchema,
  type VaultAiPluginSettings,
  type ProviderId
} from "@app/settings";
import { buildCrossChatMemory } from "@app/cross-chat-memory";
import { AgentRegistry } from "@agents/agent-registry";
import type { AgentDefinition } from "@agents/agent-types";
import { CommandsRegistry } from "../commands/commands-registry";
import type { CommandDefinition } from "../commands/command-types";
import type { AssistantResponse } from "@core/assistant-response";
import {
  ChatOrchestrator,
  type ChatRequestInput,
  type ConversationTitleInput,
  type StreamReplyCallbacks
} from "@core/chat-orchestrator";
import { ContextResolver } from "@core/context-resolver";
import type { ContextScope, ResolvedContextSummary } from "@core/context-types";
import {
  VIEW_ICON_ASSISTANT,
  VIEW_ICON_ASSISTANT_SVG,
  VIEW_TYPE_ASSISTANT
} from "@core/constants";
import { parseTurnInput } from "@core/turn-parser";
import { AnthropicAdapter } from "@providers/anthropic/anthropic-adapter";
import { OpenAiAdapter } from "@providers/openai/openai-adapter";
import { OpenRouterAdapter } from "@providers/openrouter/openrouter-adapter";
import { OllamaAdapter } from "@providers/ollama/ollama-adapter";
import { ProviderCatalogService } from "@providers/provider-catalog-service";
import { ProviderRegistry } from "@providers/provider-registry";
import type { ProviderCatalogSnapshot } from "@providers/provider-runtime";
import { resolveRuntimeModelSelection } from "@providers/runtime-model-selection";
import {
  RetrievalService,
  type RetrievedNote
} from "@retrieval/retrieval-service";
import { SchedulerService } from "@scheduler/scheduler-service";
import { SkillsRegistry } from "@skills/skills-registry";
import type { SkillDefinition } from "@skills/skill-types";
import { ConversationStorage } from "@storage/conversation-storage";
import { MemoryStorage } from "@storage/memory-storage";
import { PluginStorage } from "@storage/plugin-storage";
import type {
  PersistedConversation,
  SaveConversationInput
} from "@storage/conversation-types";
import type { PersistedMemoryEntry } from "@storage/memory-types";
import { ToolRuntime } from "@tools/tool-runtime";
import { ToolRegistry } from "@tools/tool-registry";
import type { ToolDefinition } from "@tools/tool-types";
import { AssistantView } from "@ui/views/assistant-view";
import { VaultAiPluginSettingTab } from "@ui/settings/plugin-settings-tab";
import {
  Component,
  MarkdownRenderer,
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf,
  addIcon
} from "obsidian";

export class VaultAiPlugin extends Plugin {
  settings: VaultAiPluginSettings = DEFAULT_SETTINGS;
  readonly viewType = VIEW_TYPE_ASSISTANT;

  private readonly storage = new PluginStorage(this);
  private readonly agentRegistry = new AgentRegistry(this.app);
  private readonly providerRegistry = new ProviderRegistry();
  private readonly providerCatalogService = new ProviderCatalogService(
    this.providerRegistry
  );
  private commandsRegistry = new CommandsRegistry(
    this.app,
    DEFAULT_SETTINGS.commandsRoot
  );
  private readonly toolRegistry = new ToolRegistry();
  private readonly toolRuntime = new ToolRuntime(this.app, this.toolRegistry);
  private readonly chatOrchestrator = new ChatOrchestrator(
    this.providerRegistry,
    this.toolRuntime
  );
  private readonly contextResolver = new ContextResolver(this.app);
  private conversationStorage: ConversationStorage | null = null;
  private memoryStorage: MemoryStorage | null = null;
  private retrievalService: RetrievalService | null = null;
  private schedulerService: SchedulerService | null = null;
  private skillsRegistry: SkillsRegistry | null = null;

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.registerServices();
    addIcon(VIEW_ICON_ASSISTANT, VIEW_ICON_ASSISTANT_SVG);
    this.registerView(this.viewType, (leaf) => new AssistantView(leaf, this));
    this.addSettingTab(new VaultAiPluginSettingTab(this));
    this.registerCommands();

    void this.refreshProviderCatalogs();

    if (this.settings.enableIndexingOnStartup) {
      this.retrievalService?.start();
    }

    this.schedulerService?.start();
  }

  override async onunload(): Promise<void> {
    this.retrievalService?.stop();
    this.schedulerService?.stop();
    await this.app.workspace.detachLeavesOfType(this.viewType);
  }

  async updateSettings(next: Partial<VaultAiPluginSettings>): Promise<void> {
    this.settings = pluginSettingsSchema.parse({
      ...this.settings,
      ...next
    });

    await this.storage.save(this.settings);
    this.commandsRegistry = new CommandsRegistry(
      this.app,
      this.settings.commandsRoot
    );
    this.skillsRegistry = new SkillsRegistry(
      this.app,
      this.settings.skillsRoot
    );
    this.conversationStorage = new ConversationStorage(
      this.app,
      this.settings.conversationsRoot
    );
    this.memoryStorage = new MemoryStorage(this.app, this.settings.memoryRoot);
    void this.refreshProviderCatalogs();
    this.refreshAssistantViews();
  }

  async listAgents(): Promise<AgentDefinition[]> {
    return this.agentRegistry.getPrimaryAgents(this.settings.agentsRoot);
  }

  async getAgentById(agentId: string): Promise<AgentDefinition | null> {
    return this.agentRegistry.getAgentById(agentId, this.settings.agentsRoot);
  }

  async listSkills(): Promise<SkillDefinition[]> {
    return (await this.skillsRegistry?.listSkills()) ?? [];
  }

  async listAllowedSkills(agentId: string): Promise<SkillDefinition[]> {
    const agent = await this.getAgentById(agentId);
    if (!agent || !this.skillsRegistry) {
      return [];
    }

    return this.skillsRegistry.listAllowedSkills(agent);
  }

  async listAllowedTools(agentId: string): Promise<ToolDefinition[]> {
    const agent = await this.getAgentById(agentId);
    if (!agent) {
      return [];
    }

    return this.toolRegistry.listAllowedTools(agent);
  }

  async listCommands(): Promise<CommandDefinition[]> {
    return this.commandsRegistry.listCommands();
  }

  async listMentionableNotePaths(query = ""): Promise<string[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = this.app.vault
      .getMarkdownFiles()
      .map((file) => file.path)
      .filter((path) => path.toLowerCase().includes(normalizedQuery));

    return normalizedQuery ? matches.slice(0, 50) : matches;
  }

  async loadActiveConversation(): Promise<PersistedConversation | null> {
    const activePath = await this.storage.loadActiveConversationPath();
    if (!activePath || !this.conversationStorage) {
      return null;
    }

    return this.conversationStorage.loadConversation(activePath);
  }

  async listConversations(): Promise<PersistedConversation[]> {
    return (await this.conversationStorage?.listConversations()) ?? [];
  }

  async setActiveConversationPath(path: string | null): Promise<void> {
    await this.storage.saveActiveConversationPath(path);
  }

  async loadAssistantState(): Promise<{
    providerId?: ProviderId;
    modelId?: string;
    agentId?: string;
  } | null> {
    const state = await this.storage.loadAssistantState();
    return state
      ? {
          providerId: state.providerId as ProviderId | undefined,
          modelId: state.modelId,
          agentId: state.agentId
        }
      : null;
  }

  async saveAssistantState(state: {
    providerId?: ProviderId;
    modelId?: string;
    agentId?: string;
  }): Promise<void> {
    await this.storage.saveAssistantState(state);
  }

  async saveConversation(
    input: SaveConversationInput,
    existingPath?: string | null
  ): Promise<PersistedConversation> {
    if (!this.conversationStorage) {
      throw new Error("Conversation storage is not initialized.");
    }

    const conversation = await this.conversationStorage.saveConversation(
      input,
      existingPath
    );
    await this.storage.saveActiveConversationPath(conversation.path);
    return conversation;
  }

  async generateConversationTitle(
    input: ConversationTitleInput
  ): Promise<string> {
    return this.chatOrchestrator.generateConversationTitle(
      input,
      this.settings
    );
  }

  async openConversationNote(path: string): Promise<void> {
    await this.app.workspace.openLinkText(path, "", false);
  }

  async renderMarkdown(
    markdown: string,
    containerEl: HTMLElement,
    sourcePath: string,
    component: Component
  ): Promise<void> {
    await MarkdownRenderer.render(
      this.app,
      markdown,
      containerEl,
      sourcePath,
      component
    );
  }

  openPluginSettings(): void {
    const settingTabs = (
      this.app as unknown as {
        setting?: {
          open: () => void;
          openTabById?: (id: string) => void;
        };
      }
    ).setting;

    settingTabs?.open();
    settingTabs?.openTabById?.(this.manifest.id);
  }

  getProviderCatalogSnapshots(
    providerIds: ProviderId[]
  ): ProviderCatalogSnapshot[] {
    return this.providerCatalogService.getAllSnapshots(providerIds);
  }

  async refreshProviderCatalogs(): Promise<ProviderCatalogSnapshot[]> {
    const snapshots = await this.providerCatalogService.refreshAll(
      this.settings
    );
    this.refreshAssistantViews();
    return snapshots;
  }

  async resolveContextSummary(
    scope: ContextScope
  ): Promise<ResolvedContextSummary> {
    return this.contextResolver.resolve(scope);
  }

  async generateAssistantReply(
    input: ChatRequestInput
  ): Promise<AssistantResponse> {
    const agents = await this.listAgents();
    const parsedTurn = await parseTurnInput({
      prompt: input.prompt,
      agents,
      expandCommand: (commandId, argumentsText) =>
        this.commandsRegistry.expandCommand(commandId, argumentsText)
    });
    const nextAgent = parsedTurn.agentId
      ? await this.getAgentById(parsedTurn.agentId)
      : input.agent;
    const runtimeAgent = nextAgent ?? input.agent;
    const runtimeSelection = resolveRuntimeModelSelection(
      this.getProviderCatalogSnapshots([
        "openrouter",
        "ollama",
        "openai",
        "anthropic"
      ]),
      input.providerId,
      input.modelId,
      parsedTurn.command
    );
    const [allowedTools, allowedSkills, crossChatMemory] = await Promise.all([
      this.listAllowedTools(runtimeAgent.id),
      this.listAllowedSkills(runtimeAgent.id),
      this.loadCrossChatMemory(parsedTurn.prompt, input.contextSummary)
    ]);
    const explicitNotePaths = await this.resolveMentionedNotePaths(
      parsedTurn.noteMentions
    );
    const baseContext = parsedTurn.includeAllNotes
      ? await this.resolveContextSummary("whole-vault")
      : input.contextSummary;
    const contextSummary = await this.resolvePromptContext(
      baseContext,
      explicitNotePaths,
      parsedTurn.prompt
    );

    return this.chatOrchestrator.generateReply(
      {
        ...input,
        agent: runtimeAgent,
        providerId: runtimeSelection.providerId,
        modelId: runtimeSelection.modelId,
        prompt: parsedTurn.prompt,
        contextSummary,
        allowedTools,
        allowedSkills,
        crossChatMemory
      },
      this.settings
    );
  }

  async streamAssistantReply(
    input: ChatRequestInput,
    callbacks: StreamReplyCallbacks,
    options?: { signal?: AbortSignal }
  ): Promise<AssistantResponse> {
    const agents = await this.listAgents();
    const parsedTurn = await parseTurnInput({
      prompt: input.prompt,
      agents,
      expandCommand: (commandId, argumentsText) =>
        this.commandsRegistry.expandCommand(commandId, argumentsText)
    });
    const nextAgent = parsedTurn.agentId
      ? await this.getAgentById(parsedTurn.agentId)
      : input.agent;
    const runtimeAgent = nextAgent ?? input.agent;
    const runtimeSelection = resolveRuntimeModelSelection(
      this.getProviderCatalogSnapshots([
        "openrouter",
        "ollama",
        "openai",
        "anthropic"
      ]),
      input.providerId,
      input.modelId,
      parsedTurn.command
    );
    const [allowedTools, allowedSkills, crossChatMemory] = await Promise.all([
      this.listAllowedTools(runtimeAgent.id),
      this.listAllowedSkills(runtimeAgent.id),
      this.loadCrossChatMemory(parsedTurn.prompt, input.contextSummary)
    ]);
    const explicitNotePaths = await this.resolveMentionedNotePaths(
      parsedTurn.noteMentions
    );
    const baseContext = parsedTurn.includeAllNotes
      ? await this.resolveContextSummary("whole-vault")
      : input.contextSummary;
    const contextSummary = await this.resolvePromptContext(
      baseContext,
      explicitNotePaths,
      parsedTurn.prompt
    );

    return this.chatOrchestrator.streamReply(
      {
        ...input,
        agent: runtimeAgent,
        providerId: runtimeSelection.providerId,
        modelId: runtimeSelection.modelId,
        prompt: parsedTurn.prompt,
        contextSummary,
        recentMessages: input.recentMessages,
        allowedTools,
        allowedSkills,
        crossChatMemory
      },
      this.settings,
      callbacks,
      options
    );
  }

  async activateAssistantView(): Promise<void> {
    const existingLeaf = this.app.workspace.getLeavesOfType(this.viewType)[0];
    const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);

    if (!leaf) {
      new Notice("Unable to open the assistant view.");
      return;
    }

    await leaf.setViewState({
      type: this.viewType,
      active: true
    });

    this.app.workspace.revealLeaf(leaf);
  }

  async toggleAssistantView(): Promise<void> {
    const existingLeaf = this.app.workspace.getLeavesOfType(this.viewType)[0];
    if (existingLeaf) {
      existingLeaf.detach();
      return;
    }

    await this.activateAssistantView();
  }

  private async loadSettings(): Promise<void> {
    const stored = await this.storage.load(DEFAULT_SETTINGS);
    this.settings = pluginSettingsSchema.parse({
      ...DEFAULT_SETTINGS,
      ...stored
    });
  }

  private registerServices(): void {
    this.providerRegistry.register(new OpenRouterAdapter());
    this.providerRegistry.register(new OllamaAdapter());
    this.providerRegistry.register(new OpenAiAdapter());
    this.providerRegistry.register(new AnthropicAdapter());
    this.retrievalService = new RetrievalService(this.app);
    this.schedulerService = new SchedulerService();
    this.skillsRegistry = new SkillsRegistry(
      this.app,
      this.settings.skillsRoot
    );
    this.commandsRegistry = new CommandsRegistry(
      this.app,
      this.settings.commandsRoot
    );
    this.conversationStorage = new ConversationStorage(
      this.app,
      this.settings.conversationsRoot
    );
    this.memoryStorage = new MemoryStorage(this.app, this.settings.memoryRoot);
  }

  private async resolvePromptContext(
    baseContext: ResolvedContextSummary,
    explicitNotePaths: string[],
    prompt: string
  ): Promise<ResolvedContextSummary> {
    const retrievalNotes = await this.retrievePromptNotes({
      prompt,
      preferredPaths: [...baseContext.notePaths, ...explicitNotePaths]
    });
    const retrievalNotePaths = retrievalNotes.map((note) => note.path);
    const uniquePaths = [
      ...new Set([
        ...baseContext.notePaths,
        ...explicitNotePaths,
        ...retrievalNotePaths
      ])
    ];
    const explicitEntries = await Promise.all(
      explicitNotePaths.map(async (path) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile) || file.extension !== "md") {
          return null;
        }

        return {
          path,
          content: await this.app.vault.cachedRead(file)
        };
      })
    );
    const promptBlocks = explicitEntries
      .filter(
        (entry): entry is { path: string; content: string } => entry !== null
      )
      .map((entry) =>
        [`Explicit note: ${entry.path}`, entry.content].join("\n\n")
      );
    const retrievalBlocks = retrievalNotes.map((note) =>
      [`Retrieved note: ${note.path} (score ${note.score})`, note.content].join(
        "\n\n"
      )
    );

    const descriptionParts = [baseContext.description];
    if (retrievalNotePaths.length > 0) {
      descriptionParts.push(
        `Retrieved ${retrievalNotePaths.length} supporting notes.`
      );
    }

    return {
      ...baseContext,
      description: descriptionParts.join(" "),
      notePaths: uniquePaths,
      contextNotePaths: baseContext.contextNotePaths ?? baseContext.notePaths,
      explicitNotePaths,
      retrievalNotePaths,
      retrievalNotes: retrievalNotes.map((note) => ({
        path: note.path,
        score: note.score,
        snippet: note.snippet
      })),
      retrievalQuery: prompt,
      promptContext: [
        baseContext.promptContext,
        ...promptBlocks,
        ...retrievalBlocks
      ].join("\n\n---\n\n")
    };
  }

  private async retrievePromptNotes(options: {
    prompt: string;
    preferredPaths: string[];
  }): Promise<RetrievedNote[]> {
    if (!this.retrievalService) {
      return [];
    }

    return this.retrievalService.retrieveRelevantNotes({
      query: options.prompt,
      preferredPaths: options.preferredPaths,
      excludedRoots: [this.settings.conversationsRoot]
    });
  }

  private async loadCrossChatMemory(
    prompt: string,
    contextSummary: ResolvedContextSummary
  ): Promise<Array<{ path: string; summary: string }>> {
    const [conversations, memories] = await Promise.all([
      this.listConversations(),
      this.listLongTermMemories()
    ]);

    return buildCrossChatMemory(
      conversations,
      prompt,
      contextSummary,
      memories
    );
  }

  async saveLongTermPreferenceMemory(input: {
    summary: string;
    details: string;
    sourceConversationPath?: string;
    tags?: string[];
  }): Promise<PersistedMemoryEntry | null> {
    if (!this.memoryStorage) {
      return null;
    }

    return this.memoryStorage.savePreference(input);
  }

  async saveLongTermMemory(input: {
    type: PersistedMemoryEntry["type"];
    summary: string;
    details: string;
    sourceConversationPath?: string;
    tags?: string[];
  }): Promise<PersistedMemoryEntry | null> {
    if (!this.memoryStorage) {
      return null;
    }

    return this.memoryStorage.saveMemory(input);
  }

  async updateLongTermMemory(
    id: string,
    updates: Partial<
      Pick<PersistedMemoryEntry, "summary" | "details" | "tags" | "type">
    >
  ): Promise<PersistedMemoryEntry | null> {
    if (!this.memoryStorage) {
      return null;
    }

    return this.memoryStorage.updateMemory(id, updates);
  }

  async deleteLongTermMemory(id: string): Promise<boolean> {
    if (!this.memoryStorage) {
      return false;
    }

    return this.memoryStorage.deleteMemory(id);
  }

  async listLongTermMemories(): Promise<PersistedMemoryEntry[]> {
    return (await this.memoryStorage?.listMemories()) ?? [];
  }

  private async resolveMentionedNotePaths(
    noteMentions: string[]
  ): Promise<string[]> {
    if (noteMentions.length === 0) {
      return [];
    }

    const allNotePaths = await this.listMentionableNotePaths();
    const allFolderPaths = getFolderPaths(allNotePaths);

    const matches = noteMentions.map((mention) => {
      const normalizedMention = normalizeMention(mention);
      const exactMatch = allNotePaths.find(
        (path) => path.toLowerCase() === normalizedMention
      );
      if (exactMatch) {
        return exactMatch;
      }

      const exactFolderMatch = allFolderPaths.find(
        (path) => path.toLowerCase() === ensureFolderMention(normalizedMention)
      );
      if (exactFolderMatch) {
        return allNotePaths.filter((path) =>
          path.toLowerCase().startsWith(exactFolderMatch.toLowerCase())
        );
      }

      if (normalizedMention.endsWith("/")) {
        const folderMatches = allNotePaths.filter((path) =>
          path.toLowerCase().startsWith(normalizedMention)
        );
        if (folderMatches.length > 0) {
          return folderMatches;
        }
      }

      const basenameMatches = allNotePaths.filter((path) => {
        const basename =
          path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
        return basename === normalizedMention;
      });
      if (basenameMatches.length === 1) {
        return basenameMatches[0];
      }
      if (basenameMatches.length > 1) {
        throw new Error(formatMentionAmbiguityError(mention, basenameMatches));
      }

      const fuzzyMatches = allNotePaths.filter((path) =>
        path.toLowerCase().includes(normalizedMention)
      );
      if (fuzzyMatches.length === 1) {
        return fuzzyMatches[0];
      }
      if (fuzzyMatches.length > 1) {
        throw new Error(formatMentionAmbiguityError(mention, fuzzyMatches));
      }

      throw new Error(
        `Mention '@${mention}' did not match any note in the vault.`
      );
    });

    return [...new Set(matches.flat())];
  }

  private registerCommands(): void {
    this.addCommand({
      id: "open-assistant",
      name: "Open Vault AI",
      callback: async () => {
        await this.activateAssistantView();
      }
    });

    this.addCommand({
      id: "toggle-assistant",
      name: "Toggle Vault AI",
      callback: async () => {
        await this.toggleAssistantView();
      }
    });

    this.addCommand({
      id: "show-scaffold-status",
      name: "Show scaffold status",
      callback: async () => {
        const providers = this.providerRegistry.list();
        const toolFamilies = this.toolRegistry.listToolFamilies().join(", ");
        const agentsRoot = this.settings.agentsRoot;
        const skillsRoot =
          this.skillsRegistry?.getSkillsRoot() ?? this.settings.skillsRoot;
        new Notice(
          `Providers: ${providers.length}, tools: ${toolFamilies}, agents root: ${agentsRoot}, skills root: ${skillsRoot}`,
          6000
        );
      }
    });

    this.addCommand({
      id: "refresh-provider-catalogs",
      name: "Refresh provider catalogs",
      callback: async () => {
        const snapshots = await this.refreshProviderCatalogs();
        const loadedSummary = snapshots
          .map(
            (snapshot) =>
              `${snapshot.providerId}: ${snapshot.status === "ready" ? snapshot.models.length : snapshot.status}`
          )
          .join(" | ");
        new Notice(`Provider catalogs refreshed. ${loadedSummary}`, 6000);
      }
    });
  }

  private refreshAssistantViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(this.viewType)) {
      this.refreshLeaf(leaf);
    }
  }

  private refreshLeaf(leaf: WorkspaceLeaf): void {
    const view = leaf.view;
    if (view instanceof AssistantView) {
      view.render();
    }
  }
}

function formatMentionAmbiguityError(
  mention: string,
  matches: string[]
): string {
  const preview = matches.slice(0, 4).join(", ");
  const extraCount = matches.length - Math.min(matches.length, 4);
  const suffix = extraCount > 0 ? `, and ${extraCount} more` : "";

  return `Mention '@${mention}' is ambiguous. Be more specific. Matches: ${preview}${suffix}`;
}

function normalizeMention(mention: string): string {
  return mention.trim().replace(/^\/+/, "").toLowerCase();
}

function ensureFolderMention(mention: string): string {
  return mention.endsWith("/") ? mention : `${mention}/`;
}

function getFolderPaths(notePaths: string[]): string[] {
  const folders = new Set<string>();

  for (const path of notePaths) {
    const segments = path.split("/").filter(Boolean);
    for (let index = 1; index < segments.length; index += 1) {
      folders.add(`${segments.slice(0, index).join("/")}/`);
    }
  }

  return [...folders];
}
