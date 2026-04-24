import type { AgentDefinition } from "@agents/agent-types";
import type { OpenVaultAiPlugin } from "@app/plugin";
import type { ProviderCatalogSnapshot } from "@providers/provider-runtime";
import type { PersistedConversation } from "@storage/conversation-types";
import { FuzzySuggestModal } from "obsidian";

export function openAgentMenu(options: {
  plugin: OpenVaultAiPlugin;
  agents: AgentDefinition[];
  selectedAgentId: string;
  onChoose: (agent: AgentDefinition) => void;
}): void {
  new AgentSuggestModal(options).open();
}

type ModelOption = {
  providerId: string;
  modelId: string;
  label: string;
  shortLabel?: string;
};

export function openModelSuggest(options: {
  plugin: OpenVaultAiPlugin;
  providerStatus: ProviderCatalogSnapshot["status"];
  selectedProviderId: string;
  items: ModelOption[];
  onChoose: (item: ModelOption) => void;
}): void {
  new ModelSuggestModal(options).open();
}

export function openConversationSuggest(options: {
  plugin: OpenVaultAiPlugin;
  conversations: PersistedConversation[];
  onChoose: (conversation: PersistedConversation) => void;
}): void {
  new ConversationSuggestModal(options).open();
}

class ModelSuggestModal extends FuzzySuggestModal<ModelOption> {
  private readonly items: ModelOption[];

  constructor(
    private readonly options: {
      plugin: OpenVaultAiPlugin;
      providerStatus: ProviderCatalogSnapshot["status"];
      selectedProviderId: string;
      items: ModelOption[];
      onChoose: (item: ModelOption) => void;
    }
  ) {
    super(options.plugin.app);
    this.items = options.items;
    this.setPlaceholder("Select model");
    this.emptyStateText = getModelEmptyState(
      options.providerStatus,
      options.selectedProviderId
    );
  }

  getItems(): ModelOption[] {
    return this.items;
  }

  getItemText(item: ModelOption): string {
    return item.shortLabel ?? item.label;
  }

  override renderSuggestion(
    item: { item: ModelOption },
    el: HTMLElement
  ): void {
    el.addClass("openvault-ai__native-suggest-item");
    el.createDiv({
      cls: "openvault-ai__native-suggest-title",
      text: item.item.label
    });
    el.createDiv({
      cls: "openvault-ai__native-suggest-meta",
      text: item.item.providerId
    });
  }

  onChooseItem(item: ModelOption): void {
    this.options.onChoose(item);
  }
}

class AgentSuggestModal extends FuzzySuggestModal<AgentDefinition> {
  private readonly items: AgentDefinition[];

  constructor(
    private readonly options: {
      plugin: OpenVaultAiPlugin;
      agents: AgentDefinition[];
      selectedAgentId: string;
      onChoose: (agent: AgentDefinition) => void;
    }
  ) {
    super(options.plugin.app);
    this.items = options.agents;
    this.setPlaceholder("Select agent");
    this.emptyStateText = "No agents available.";
  }

  getItems(): AgentDefinition[] {
    return this.items;
  }

  getItemText(item: AgentDefinition): string {
    return item.name;
  }

  override renderSuggestion(
    item: { item: AgentDefinition },
    el: HTMLElement
  ): void {
    el.addClass("openvault-ai__native-suggest-item");
    el.createDiv({
      cls: "openvault-ai__native-suggest-title",
      text: item.item.name
    });
  }

  onChooseItem(item: AgentDefinition): void {
    this.options.onChoose(item);
  }
}

class ConversationSuggestModal extends FuzzySuggestModal<PersistedConversation> {
  private readonly items: PersistedConversation[];

  constructor(
    private readonly options: {
      plugin: OpenVaultAiPlugin;
      conversations: PersistedConversation[];
      onChoose: (conversation: PersistedConversation) => void;
    }
  ) {
    super(options.plugin.app);
    this.items = options.conversations;
    this.setPlaceholder("Open chat");
    this.emptyStateText = "No saved chats.";
  }

  getItems(): PersistedConversation[] {
    return this.items;
  }

  getItemText(item: PersistedConversation): string {
    return item.title;
  }

  override renderSuggestion(
    item: { item: PersistedConversation },
    el: HTMLElement
  ): void {
    el.addClass("openvault-ai__native-suggest-item");
    el.createDiv({
      cls: "openvault-ai__native-suggest-title",
      text: item.item.title
    });
    el.createDiv({
      cls: "openvault-ai__native-suggest-meta",
      text: formatConversationTimestamp(item.item.updatedAt)
    });
  }

  onChooseItem(item: PersistedConversation): void {
    this.options.onChoose(item);
  }
}

function getModelEmptyState(
  status: ProviderCatalogSnapshot["status"],
  providerId: string
): string {
  if (status === "loading") {
    return `Loading ${providerId} models...`;
  }

  if (status === "error") {
    return `Could not load models for ${providerId}.`;
  }

  return `No models available for ${providerId}.`;
}

function formatConversationTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
