import type { AgentDefinition } from "@agents/agent-types";
import { SUPPORTED_PROVIDERS } from "@app/defaults";
import type { VaultAiPlugin } from "@app/plugin";
import type { VaultAiPluginSettings, ProviderId } from "@app/settings";
import type { CommandDefinition } from "../../commands/command-types";
import type { ResolvedContextSummary } from "@core/context-types";
import {
  applySuggestion,
  getCommandSuggestions,
  getMentionSuggestions
} from "@core/turn-parser";
import type { ProviderCatalogSnapshot } from "@providers/provider-runtime";
import {
  findExactGenerationModel,
  getFirstGenerationModelForProvider,
  getGenerationModelsForProvider
} from "@providers/provider-selection";
import type { PersistedConversation } from "@storage/conversation-types";
import { formatCitationLabel, getVisibleCitations } from "@ui/citation-display";
import { createMessage, type AssistantMessage } from "@ui/assistant-state";
import {
  findLastSuccessfulAssistantMessage,
  proposeLongTermMemories
} from "@app/memory-analysis";
import {
  openAgentMenu,
  openConversationSuggest,
  openModelSuggest
} from "./native-pickers";
import { Component } from "obsidian";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

type AssistantShellProps = {
  plugin: VaultAiPlugin;
  settings: VaultAiPluginSettings;
};

type SuggestionItem = {
  key: string;
  label: string;
  description: string;
  detail?: string;
  insertText: string;
  section: string;
};

type ModelOption = {
  key: string;
  providerId: ProviderId;
  modelId: string;
  label: string;
  shortLabel: string;
};

const MAX_INLINE_SUGGESTIONS = 7;
const MODEL_KEY_SEPARATOR = "::";

export function AssistantShell({ plugin, settings }: AssistantShellProps) {
  const [catalogs, setCatalogs] = useState<ProviderCatalogSnapshot[]>(() =>
    plugin.getProviderCatalogSnapshots(SUPPORTED_PROVIDERS)
  );
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [conversations, setConversations] = useState<PersistedConversation[]>(
    []
  );
  const [selectedAgentId, setSelectedAgentId] = useState(settings.defaultAgent);
  const [selectedModel, setSelectedModel] = useState(settings.defaultChatModel);
  const [conversationPath, setConversationPath] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] =
    useState<string>("New chat");
  const [contextSummary, setContextSummary] =
    useState<ResolvedContextSummary | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [mentionableNotePaths, setMentionableNotePaths] = useState<string[]>(
    []
  );
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [hasManualModelSelection, setHasManualModelSelection] = useState(false);
  const isHydratingConversationRef = useRef(false);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCatalogs(plugin.getProviderCatalogSnapshots(SUPPORTED_PROVIDERS));
  }, [plugin, settings]);

  useEffect(() => {
    let isMounted = true;

    const loadSessionData = async () => {
      const [
        nextAgents,
        activeConversation,
        savedAssistantState,
        nextCommands,
        nextNotePaths,
        nextConversations
      ] = await Promise.all([
        plugin.listAgents(),
        plugin.loadActiveConversation(),
        plugin.loadAssistantState(),
        plugin.listCommands(),
        plugin.listMentionableNotePaths(),
        plugin.listConversations()
      ]);

      if (!isMounted) {
        return;
      }

      setAgents(nextAgents);
      setCommands(nextCommands);
      setMentionableNotePaths(nextNotePaths);
      setConversations(nextConversations);

      if (activeConversation) {
        applyConversation(activeConversation);
        return;
      }

      setConversationTitle("New chat");

      if (savedAssistantState) {
        setSelectedAgentId(
          savedAssistantState.agentId ?? settings.defaultAgent
        );
        setSelectedModel(
          savedAssistantState.modelId ?? settings.defaultChatModel
        );
        setHasManualModelSelection(Boolean(savedAssistantState.modelId));
        return;
      }

      setSelectedAgentId(settings.defaultAgent);
      setSelectedModel(settings.defaultChatModel);
    };

    void loadSessionData();

    return () => {
      isMounted = false;
    };
  }, [plugin, settings]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );
  const selectedProvider = settings.defaultProvider;
  const selectedCatalog = useMemo(
    () =>
      catalogs.find((catalog) => catalog.providerId === selectedProvider) ??
      null,
    [catalogs, selectedProvider]
  );
  const selectedProviderStatus = selectedCatalog?.status ?? "idle";
  const availableModels =
    selectedCatalog?.models.filter((model) => model.supportsGeneration) ?? [];
  const providerModelOptions = useMemo<ModelOption[]>(
    () =>
      getGenerationModelsForProvider(catalogs, selectedProvider).map(
        (model) => ({
          key: `${model.providerId}${MODEL_KEY_SEPARATOR}${model.modelId}`,
          providerId: model.providerId,
          modelId: model.modelId,
          label: model.displayName,
          shortLabel: model.displayName
        })
      ),
    [catalogs, selectedProvider]
  );
  const resolvedSelection = useMemo(
    () =>
      findExactGenerationModel(catalogs, {
        providerId: selectedProvider,
        modelId: selectedModel
      }),
    [catalogs, selectedModel, selectedProvider]
  );
  const resolvedProviderId = resolvedSelection?.providerId ?? selectedProvider;
  const resolvedModelId = resolvedSelection?.modelId ?? selectedModel;
  const selectedModelOption =
    providerModelOptions.find((option) => option.modelId === resolvedModelId) ??
    (resolvedSelection
      ? (providerModelOptions.find(
          (option) =>
            option.providerId === resolvedSelection.providerId &&
            option.modelId === resolvedSelection.modelId
        ) ?? null)
      : null);
  const commandSuggestions = useMemo(
    () => getCommandSuggestions(prompt, commands),
    [commands, prompt]
  );
  const mentionSuggestions = useMemo(
    () =>
      getMentionSuggestions({
        prompt,
        agents,
        notePaths: mentionableNotePaths
      }),
    [agents, mentionableNotePaths, prompt]
  );
  const activeToken = useMemo(() => getActiveToken(prompt), [prompt]);
  const combinedSuggestions = useMemo<SuggestionItem[]>(() => {
    const extraSuggestions =
      activeToken?.trigger === "/" && "clear".startsWith(activeToken.query)
        ? [
            {
              key: "command-clear",
              label: "/clear",
              description: "Clear the current chat",
              detail: "Command",
              insertText: "/clear",
              section: "Commands"
            }
          ]
        : [];

    return [
      ...commandSuggestions.map((command) => ({
        key: `command-${command.id}`,
        label: `/${command.id}`,
        description: command.description,
        detail: "Command",
        insertText: `/${command.id}`,
        section: "Commands"
      })),
      ...extraSuggestions,
      ...mentionSuggestions.map((suggestion) => ({
        key: `${suggestion.type}-${suggestion.id}`,
        label: suggestion.label,
        description: suggestion.description,
        detail: suggestion.detail,
        insertText: suggestion.insertText,
        section:
          suggestion.type === "agent"
            ? "Agent"
            : suggestion.type === "folder"
              ? "Folder"
              : suggestion.type === "context"
                ? "Context"
                : "Note"
      }))
    ].slice(0, MAX_INLINE_SUGGESTIONS);
  }, [activeToken, commandSuggestions, mentionSuggestions]);
  const canSend = Boolean(
    prompt.trim() &&
    contextSummary &&
    selectedAgent &&
    !isSending &&
    resolvedModelId
  );
  const isComposerDisabled = isSending;

  useEffect(() => {
    if (!selectedAgent || hasManualModelSelection) {
      return;
    }

    setSelectedModel(selectedAgent.model);
  }, [hasManualModelSelection, selectedAgent]);

  useEffect(() => {
    setHasManualModelSelection(false);
  }, [selectedProvider]);

  useEffect(() => {
    if (availableModels.length === 0) {
      return;
    }

    const hasSelectedModel = availableModels.some(
      (model) => model.modelId === selectedModel
    );

    if (!hasSelectedModel) {
      const firstGenerationModel = getFirstGenerationModelForProvider(
        catalogs,
        selectedProvider
      );
      if (firstGenerationModel) {
        setSelectedModel(firstGenerationModel.modelId);
      }
    }
  }, [availableModels, catalogs, selectedModel, selectedProvider]);

  useEffect(() => {
    let isMounted = true;

    const loadContext = async () => {
      const summary = await plugin.resolveContextSummary("current-note");
      if (!isMounted) {
        return;
      }

      setContextSummary(summary);
    };

    void loadContext();

    return () => {
      isMounted = false;
    };
  }, [plugin]);

  useEffect(() => {
    const element = conversationRef.current;
    if (!element || !shouldAutoScrollRef.current) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    void plugin.saveAssistantState({
      modelId: resolvedModelId,
      agentId: selectedAgentId
    });
  }, [plugin, resolvedModelId, selectedAgentId]);

  const handleConversationScroll = () => {
    const element = conversationRef.current;
    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 48;
  };

  const reloadConversations = async (nextActivePath?: string | null) => {
    const nextConversations = await plugin.listConversations();
    setConversations(nextConversations);

    if (nextActivePath !== undefined) {
      setConversationPath(nextActivePath);
    }
  };

  const applyActiveSuggestion = () => {
    const selectedSuggestion = combinedSuggestions[selectedSuggestionIndex];
    if (!selectedSuggestion) {
      return false;
    }

    setPrompt((currentPrompt) => {
      const nextPrompt = applySuggestion(
        currentPrompt,
        selectedSuggestion.insertText
      );
      return `${nextPrompt} `;
    });
    setSelectedSuggestionIndex(0);

    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
      const input = composerInputRef.current;
      if (input) {
        const position = input.value.length;
        input.setSelectionRange(position, position);
      }
    });

    return true;
  };

  const startNewChat = async () => {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    setIsSending(false);
    setMessages([]);
    setPrompt("");
    setConversationPath(null);
    setConversationTitle("New chat");
    setSelectedSuggestionIndex(0);
    shouldAutoScrollRef.current = true;
    await plugin.setActiveConversationPath(null);
    await reloadConversations(null);
  };

  const openConversation = async (conversation: PersistedConversation) => {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    setIsSending(false);
    applyConversation(conversation);
    shouldAutoScrollRef.current = true;
    await plugin.setActiveConversationPath(conversation.path);
  };

  const openAgentPicker = () => {
    openAgentMenu({
      plugin,
      agents,
      selectedAgentId,
      onChoose: (agent) => {
        setSelectedAgentId(agent.id);
        setHasManualModelSelection(false);
      }
    });
  };

  const openModelPicker = () => {
    openModelSuggest({
      plugin,
      providerStatus: selectedProviderStatus,
      selectedProviderId: selectedProvider,
      items: providerModelOptions,
      onChoose: (option) => {
        setSelectedModel(option.modelId);
        setHasManualModelSelection(true);
      }
    });
  };

  const openChatsPicker = () => {
    openConversationSuggest({
      plugin,
      conversations,
      onChoose: (conversation) => {
        void openConversation(conversation);
      }
    });
  };

  const persistConversation = async (
    nextMessages: AssistantMessage[],
    override?: {
      title?: string;
      existingPath?: string | null;
      contextSummary?: ResolvedContextSummary;
    }
  ) => {
    const nextContextSummary = override?.contextSummary ?? contextSummary;
    if (!selectedAgent || !nextContextSummary) {
      return null;
    }

    const persistedConversation = await plugin.saveConversation(
      {
        title: override?.title ?? conversationTitle,
        agentId: selectedAgent.id,
        providerId: resolvedProviderId,
        modelId: resolvedModelId,
        contextScope: "current-note",
        referencedNotes: nextContextSummary.notePaths,
        messages: nextMessages.map(toStoredConversationMessage)
      },
      override?.existingPath ?? conversationPath
    );

    setConversationPath(persistedConversation.path);
    setConversationTitle(persistedConversation.title);
    await reloadConversations(persistedConversation.path);

    return persistedConversation;
  };

  useEffect(() => {
    if (!conversationPath || isHydratingConversationRef.current) {
      return;
    }

    void persistConversation(
      messages.filter((message) => message.status !== "pending"),
      {
        existingPath: conversationPath
      }
    );
  }, [
    conversationPath,
    messages,
    resolvedModelId,
    selectedAgentId,
    selectedProvider
  ]);

  const maybeGenerateConversationTitle = async (
    persistedConversation: PersistedConversation,
    nextMessages: AssistantMessage[]
  ) => {
    if (
      persistedConversation.title !== "New chat" &&
      !/^\d{4}-\d{2}-\d{2}T/.test(persistedConversation.title)
    ) {
      return;
    }

    const firstUserMessage = nextMessages.find(
      (message) => message.role === "user"
    );
    const firstAssistantMessage = nextMessages.find(
      (message) => message.role === "assistant" && message.status === "done"
    );

    if (!firstUserMessage || !firstAssistantMessage) {
      return;
    }

    try {
      const title = await plugin.generateConversationTitle({
        providerId: resolvedProviderId,
        modelId: resolvedModelId,
        firstUserMessage: firstUserMessage.text,
        firstAssistantMessage: firstAssistantMessage.text
      });

      if (!title || title === "New chat") {
        return;
      }

      setConversationTitle(title);
      await persistConversation(nextMessages, {
        title,
        existingPath: persistedConversation.path
      });
    } catch {
      // Title generation is best-effort and should not block chat usage.
    }
  };

  const sendPromptAsync = async () => {
    const trimmedPrompt = prompt.trim();

    if (trimmedPrompt === "/clear") {
      await startNewChat();
      return;
    }

    if (!trimmedPrompt || !contextSummary || !selectedAgent || !canSend) {
      return;
    }

    const freshContextSummary =
      await plugin.resolveContextSummary("current-note");
    setContextSummary(freshContextSummary);

    const userMessage = createMessage("user", trimmedPrompt);
    const pendingAssistantMessage = createMessage(
      "assistant",
      "Thinking...",
      "pending"
    );
    const queuedMessages = [...messages, userMessage, pendingAssistantMessage];
    const recentMessages = messages
      .filter((message) => message.status !== "pending")
      .slice(-6)
      .map((message) => ({
        role: message.role,
        text: message.text
      }));
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    shouldAutoScrollRef.current = true;
    setMessages(queuedMessages);
    setPrompt("");
    setSelectedSuggestionIndex(0);
    setIsSending(true);
    requestAnimationFrame(() => composerInputRef.current?.focus());

    try {
      const reply = await plugin.streamAssistantReply(
        {
          agent: selectedAgent,
          providerId: resolvedProviderId,
          modelId: resolvedModelId,
          prompt: trimmedPrompt,
          contextSummary: freshContextSummary,
          recentMessages
        },
        {
          onDelta: (delta) => {
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.id === pendingAssistantMessage.id
                  ? {
                      ...message,
                      text:
                        message.text === "Thinking..."
                          ? delta
                          : `${message.text}${delta}`
                    }
                  : message
              )
            );
          }
        },
        {
          signal: abortController.signal
        }
      );

      const nextMessages = queuedMessages.map((message) =>
        message.id === pendingAssistantMessage.id
          ? {
              ...message,
              text: reply.text,
              citations: reply.citations,
              toolEvents: reply.toolEvents,
              status: "done" as const
            }
          : message
      );

      setMessages(nextMessages);
      const persistedConversation = await persistConversation(nextMessages, {
        contextSummary: freshContextSummary
      });

      if (persistedConversation) {
        await maybePersistLongTermMemory(
          trimmedPrompt,
          nextMessages,
          freshContextSummary,
          persistedConversation
        );
      }

      if (persistedConversation && messages.length === 0) {
        void maybeGenerateConversationTitle(
          persistedConversation,
          nextMessages
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        const nextMessages = queuedMessages.filter(
          (message) => message.id !== pendingAssistantMessage.id
        );
        setMessages(nextMessages);
        if (nextMessages.length > 0) {
          await persistConversation(nextMessages, {
            contextSummary: freshContextSummary
          });
        }
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown assistant error";
      const nextMessages = queuedMessages.map((message) =>
        message.id === pendingAssistantMessage.id
          ? {
              ...message,
              text: `Request failed: ${errorMessage}`,
              status: "error" as const
            }
          : message
      );

      setMessages(nextMessages);
      await persistConversation(nextMessages, {
        contextSummary: freshContextSummary
      });
    } finally {
      activeAbortControllerRef.current = null;
      setIsSending(false);
      requestAnimationFrame(() => composerInputRef.current?.focus());
    }
  };

  const cancelActiveRequest = () => {
    activeAbortControllerRef.current?.abort();
  };

  const maybePersistLongTermMemory = async (
    userPrompt: string,
    nextMessages: AssistantMessage[],
    nextContextSummary: ResolvedContextSummary,
    persistedConversation: PersistedConversation
  ) => {
    const assistantMessage = findLastSuccessfulAssistantMessage(nextMessages);
    if (!assistantMessage) {
      return;
    }

    const proposedMemories = proposeLongTermMemories({
      userPrompt,
      assistantReply: assistantMessage.text,
      contextNotePaths: nextContextSummary.notePaths
    });

    await Promise.all(
      proposedMemories.map((memory) =>
        plugin.saveLongTermMemory({
          ...memory,
          sourceConversationPath: persistedConversation.path,
          tags: [...new Set([selectedAgentId, ...memory.tags])]
        })
      )
    );
  };

  const copyMessage = async (message: AssistantMessage) => {
    await navigator.clipboard.writeText(formatMessageText(message.text));
  };

  const applyConversation = (conversation: PersistedConversation) => {
    isHydratingConversationRef.current = true;
    setConversationPath(conversation.path);
    setConversationTitle(conversation.title);
    setSelectedAgentId(conversation.agentId);
    setSelectedModel(conversation.modelId);
    setHasManualModelSelection(true);
    setMessages(
      conversation.messages.map((message) =>
        createMessage(
          message.role,
          message.text,
          message.status ?? "done",
          message.citations,
          message.toolEvents
        )
      )
    );
    requestAnimationFrame(() => {
      isHydratingConversationRef.current = false;
    });
  };

  const handleComposerKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Tab" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      combinedSuggestions.length > 0
    ) {
      event.preventDefault();
      applyActiveSuggestion();
      return;
    }

    if (event.key === "ArrowDown" && combinedSuggestions.length > 0) {
      event.preventDefault();
      setSelectedSuggestionIndex(
        (currentIndex) => (currentIndex + 1) % combinedSuggestions.length
      );
      return;
    }

    if (event.key === "ArrowUp" && combinedSuggestions.length > 0) {
      event.preventDefault();
      setSelectedSuggestionIndex((currentIndex) =>
        currentIndex === 0 ? combinedSuggestions.length - 1 : currentIndex - 1
      );
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPromptAsync();
      return;
    }

    if (event.key === "Escape") {
      if (isSending) {
        event.preventDefault();
        cancelActiveRequest();
        return;
      }

      setSelectedSuggestionIndex(0);
    }
  };

  return (
    <div className="vault-ai__view">
      <header className="vault-ai__header">
        <div className="vault-ai__title-stack">
          <h1 className="vault-ai__title">Vault AI</h1>
          <span className="vault-ai__subtitle">{conversationTitle}</span>
        </div>
        <div className="vault-ai__header-actions">
          <button
            className="mod-muted vault-ai__header-button vault-ai__header-button--square"
            onClick={() => void startNewChat()}
            type="button"
            aria-label="New chat"
            title="New chat"
          >
            +
          </button>
          <button
            className="mod-muted vault-ai__header-button"
            onClick={openChatsPicker}
            type="button"
            aria-label="Chats"
            title="Chats"
          >
            Chats
          </button>
          <button
            className="mod-muted vault-ai__header-button vault-ai__header-button--square"
            onClick={() => plugin.openPluginSettings()}
            type="button"
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      <div className="vault-ai__body">
        <div className="vault-ai__chat-surface">
          <div className="vault-ai__conversation-thread">
            <div
              className="vault-ai__conversation"
              ref={conversationRef}
              onScroll={handleConversationScroll}
            >
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`vault-ai__message vault-ai__message--${message.role} vault-ai__message--${message.status ?? "done"}`}
                >
                  <div className="vault-ai__message-header">
                    <strong>
                      {message.role === "user" ? "You" : "Assistant"}
                    </strong>
                    <button
                      className="clickable-icon vault-ai__message-action"
                      onClick={() => void copyMessage(message)}
                      type="button"
                      aria-label="Copy message"
                      title="Copy"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                  <MessageMarkdown
                    plugin={plugin}
                    text={formatMessageText(message.text)}
                  />
                  {message.status !== "error" &&
                  getVisibleCitations(message.citations).length > 0 ? (
                    <details className="vault-ai__message-meta" open>
                      <summary>
                        Sources {getVisibleCitations(message.citations).length}
                      </summary>
                      <ul className="vault-ai__message-source-list">
                        {getVisibleCitations(message.citations).map(
                          (citation) => {
                            const sourceLabel = formatCitationLabel(
                              citation.path
                            );
                            return (
                              <li key={`${message.id}-${citation.path}`}>
                                <button
                                  className="vault-ai__source-link"
                                  onClick={() =>
                                    void plugin.openConversationNote(
                                      citation.path
                                    )
                                  }
                                  type="button"
                                  title={citation.path}
                                >
                                  <span className="vault-ai__source-link-title">
                                    {sourceLabel.title}
                                  </span>
                                  {sourceLabel.detail ? (
                                    <span className="vault-ai__source-link-detail">
                                      {sourceLabel.detail}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          }
                        )}
                      </ul>
                    </details>
                  ) : null}
                  {message.toolEvents && message.toolEvents.length > 0 ? (
                    <details className="vault-ai__message-meta">
                      <summary>Activity</summary>
                      <ul className="vault-ai__message-activity-list">
                        {message.toolEvents.map((toolEvent) => (
                          <li
                            key={`${message.id}-${toolEvent.toolId}-${toolEvent.status}`}
                          >
                            {formatToolEvent(
                              toolEvent.toolId,
                              toolEvent.status,
                              toolEvent.message
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="vault-ai__composer-shell">
            <div className="vault-ai__composer-input-wrap">
              {combinedSuggestions.length > 0 ? (
                <div className="vault-ai__suggestions">
                  {combinedSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.key}
                      className={`vault-ai__suggestion ${index === selectedSuggestionIndex ? "is-selected" : ""}`}
                      onClick={() => {
                        setSelectedSuggestionIndex(index);
                        setPrompt((currentPrompt) => {
                          const nextPrompt = applySuggestion(
                            currentPrompt,
                            suggestion.insertText
                          );
                          return `${nextPrompt} `;
                        });
                        requestAnimationFrame(() =>
                          composerInputRef.current?.focus()
                        );
                      }}
                      type="button"
                    >
                      <span className="vault-ai__suggestion-leading">
                        <span className="vault-ai__suggestion-title">
                          {suggestion.label}
                        </span>
                        {suggestion.detail ? (
                          <small className="vault-ai__suggestion-detail">
                            {suggestion.detail}
                          </small>
                        ) : null}
                      </span>
                      <small className="vault-ai__suggestion-meta">
                        {suggestion.description}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="vault-ai__field vault-ai__composer-field">
                <textarea
                  ref={composerInputRef}
                  rows={4}
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setSelectedSuggestionIndex(0);
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Ask anything..."
                  disabled={isComposerDisabled}
                />
              </label>
            </div>

            <div className="vault-ai__composer-footer">
              <div className="vault-ai__composer-controls">
                <div className="vault-ai__control-cluster">
                  <button
                    className="vault-ai__control-button vault-ai__control-button--compact"
                    onClick={openAgentPicker}
                    type="button"
                  >
                    <span className="vault-ai__control-value">
                      {selectedAgent?.name ?? formatAgentLabel(selectedAgentId)}
                    </span>
                  </button>
                </div>

                <div className="vault-ai__control-cluster">
                  <button
                    className="vault-ai__control-button vault-ai__control-button--compact vault-ai__control-button--model"
                    onClick={openModelPicker}
                    type="button"
                  >
                    <span className="vault-ai__control-value">
                      {selectedModelOption?.label ??
                        formatModelLabel(
                          resolvedProviderId,
                          resolvedModelId,
                          selectedProviderStatus
                        )}
                    </span>
                  </button>
                </div>
              </div>

              <button
                className="mod-cta vault-ai__send-button"
                disabled={!isSending && !canSend}
                onClick={() =>
                  isSending ? cancelActiveRequest() : void sendPromptAsync()
                }
                type="button"
              >
                {isSending
                  ? "Stop"
                  : prompt.trim() === "/clear"
                    ? "Clear"
                    : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getActiveToken(prompt: string): {
  trigger: "/" | "@";
  query: string;
} | null {
  const match = prompt.match(/(^|\s)([@/])([^\s@/]*)$/);
  if (!match) {
    return null;
  }

  return {
    trigger: match[2] as "/" | "@",
    query: (match[3] ?? "").toLowerCase()
  };
}

function formatMessageText(text: string): string {
  return text
    .replace(/^Request failed:\s*/i, "")
    .replace(/```TOOL_CALL[\s\S]*?```/g, "")
    .replace(/```\s*```/g, "")
    .trim();
}

function formatToolEvent(
  toolId: string,
  status: string,
  message: string
): string {
  return `${toolId} ${status}: ${message}`;
}

function formatModelLabel(
  providerId: ProviderId,
  modelId: string,
  status: ProviderCatalogSnapshot["status"]
): string {
  if (status === "loading" || status === "idle") {
    return "Loading model...";
  }

  if (!modelId) {
    return `${providerId}/Select model`;
  }

  return `${providerId}/${modelId}`;
}

function formatAgentLabel(agentId: string): string {
  if (!agentId) {
    return "Agent";
  }

  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

function toStoredConversationMessage(
  message: AssistantMessage
): PersistedConversation["messages"][number] {
  return {
    role: message.role,
    text: message.text,
    citations: message.citations,
    toolEvents: message.toolEvents,
    status: message.status === "pending" ? "done" : (message.status ?? "done")
  };
}

function GearIcon() {
  return (
    <svg aria-hidden="true" className="vault-ai__gear-icon" viewBox="0 0 24 24">
      <path
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.06 7.06 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.89 2h-3.78a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.72 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.07.63-.07.94s.03.63.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.78a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="vault-ai__copy-icon" viewBox="0 0 24 24">
      <path
        d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z"
        fill="currentColor"
      />
    </svg>
  );
}

type MessageMarkdownProps = {
  plugin: VaultAiPlugin;
  text: string;
};

function MessageMarkdown({ plugin, text }: MessageMarkdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.empty();
    if (!text.trim()) {
      return;
    }
    const component = new Component();

    const enhancedText = replaceVaultPathsWithLinks(text);
    void plugin
      .renderMarkdown(enhancedText, container, "", component)
      .then(() => {
        const links = container.findAll('a.internal-link[href$=".md"]');
        for (const link of links) {
          const href = link.getAttr("href");
          if (!href) {
            continue;
          }

          link.onClickEvent((event) => {
            event.preventDefault();
            void plugin.openConversationNote(href);
          });
        }
      });

    return () => {
      component.unload();
    };
  }, [plugin, text]);

  return <div className="vault-ai__message-markdown" ref={containerRef} />;
}

function replaceVaultPathsWithLinks(text: string): string {
  return prettifyQuotedMentions(text).replace(
    /(?<!\]\()(?<!\[\[)([A-Za-z0-9 _./-]+\.md)\b/g,
    (match) => `[[${match}]]`
  );
}

function prettifyQuotedMentions(text: string): string {
  return text.replace(/@"([^"]+\.md)"/g, (_match, path: string) => `@${path}`);
}
