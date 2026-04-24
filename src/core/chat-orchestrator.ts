import type { AgentDefinition } from "@agents/agent-types";
import type { OpenVaultAiPluginSettings, ProviderId } from "@app/settings";
import type { AssistantResponse } from "@core/assistant-response";
import type { ResolvedContextSummary } from "@core/context-types";
import type { ProviderRegistry } from "@providers/provider-registry";
import type { SkillDefinition } from "@skills/skill-types";
import type { ToolDefinition } from "@tools/tool-types";
import type {
  ToolCallInput,
  ToolRunResult,
  ToolRuntime
} from "@tools/tool-runtime";

export interface ChatRequestInput {
  agent: AgentDefinition;
  providerId: ProviderId;
  modelId: string;
  prompt: string;
  contextSummary: ResolvedContextSummary;
  recentMessages?: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
  crossChatMemory?: Array<{
    path: string;
    summary: string;
  }>;
  allowedTools?: ToolDefinition[];
  allowedSkills?: SkillDefinition[];
}

export interface ConversationTitleInput {
  providerId: ProviderId;
  modelId: string;
  firstUserMessage: string;
  firstAssistantMessage: string;
}

export interface StreamReplyCallbacks {
  onDelta: (delta: string) => void;
}

export interface StreamReplyOptions {
  signal?: AbortSignal;
}

export class ChatOrchestrator {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly toolRuntime?: ToolRuntime
  ) {}

  async generateReply(
    input: ChatRequestInput,
    settings: OpenVaultAiPluginSettings
  ): Promise<AssistantResponse> {
    const adapter = this.registry.get(input.providerId);
    if (!adapter) {
      throw new Error(`Provider '${input.providerId}' is not registered.`);
    }

    const response = await adapter.generateText(
      {
        modelId: input.modelId,
        systemPrompt: input.agent.prompt,
        userPrompt: buildUserPrompt(
          input.prompt,
          input.contextSummary,
          input.recentMessages,
          input.crossChatMemory,
          input.allowedTools,
          input.allowedSkills
        ),
        temperature: input.agent.temperature
      },
      settings
    );

    const toolCall = parseToolCall(response.text);
    if (toolCall && this.toolRuntime) {
      const toolResult = await this.toolRuntime.runTool(input.agent, toolCall);
      const baseText = stripToolCallBlocks(response.text);
      if (toolResult.status === "allowed" && toolResult.output) {
        const followUp = await adapter.generateText(
          {
            modelId: input.modelId,
            systemPrompt: input.agent.prompt,
            userPrompt: buildToolFollowUpPrompt(
              input.prompt,
              input.contextSummary,
              input.recentMessages,
              input.crossChatMemory,
              input.allowedTools,
              input.allowedSkills,
              toolCall,
              toolResult.output
            ),
            temperature: input.agent.temperature
          },
          settings
        );

        return {
          text: followUp.text,
          citations: createCitations(
            followUp.text,
            input.contextSummary,
            toolCall,
            toolResult
          ),
          toolEvents: [toolResult]
        };
      }

      if (
        toolResult.status === "denied" ||
        toolResult.status === "approval-required"
      ) {
        return {
          text: appendToolResult(
            baseText,
            buildBlockedToolExplanation(toolResult)
          ),
          citations: createCitations(
            baseText,
            input.contextSummary,
            toolCall,
            toolResult
          ),
          toolEvents: [toolResult]
        };
      }

      return {
        text: appendToolResult(baseText, toolResult.message),
        citations: createCitations(
          baseText,
          input.contextSummary,
          toolCall,
          toolResult
        ),
        toolEvents: [toolResult]
      };
    }

    return {
      text: response.text,
      citations: createCitations(response.text, input.contextSummary)
    };
  }

  async streamReply(
    input: ChatRequestInput,
    settings: OpenVaultAiPluginSettings,
    callbacks: StreamReplyCallbacks,
    options: StreamReplyOptions = {}
  ): Promise<AssistantResponse> {
    const adapter = this.registry.get(input.providerId);
    if (!adapter) {
      throw new Error(`Provider '${input.providerId}' is not registered.`);
    }

    if (!adapter.streamText) {
      return this.generateReply(input, settings);
    }

    const response = await adapter.streamText(
      {
        modelId: input.modelId,
        systemPrompt: input.agent.prompt,
        userPrompt: buildUserPrompt(
          input.prompt,
          input.contextSummary,
          input.recentMessages,
          input.crossChatMemory,
          input.allowedTools,
          input.allowedSkills
        ),
        temperature: input.agent.temperature
      },
      settings,
      callbacks,
      options
    );

    const toolCall = parseToolCall(response.text);
    if (toolCall && this.toolRuntime) {
      const toolResult = await this.toolRuntime.runTool(input.agent, toolCall);
      const baseText = stripToolCallBlocks(response.text);

      if (toolResult.status === "allowed" && toolResult.output) {
        const followUp = await adapter.generateText(
          {
            modelId: input.modelId,
            systemPrompt: input.agent.prompt,
            userPrompt: buildToolFollowUpPrompt(
              input.prompt,
              input.contextSummary,
              input.recentMessages,
              input.crossChatMemory,
              input.allowedTools,
              input.allowedSkills,
              toolCall,
              toolResult.output
            ),
            temperature: input.agent.temperature
          },
          settings
        );

        return {
          text: followUp.text,
          citations: createCitations(
            followUp.text,
            input.contextSummary,
            toolCall,
            toolResult
          ),
          toolEvents: [toolResult]
        };
      }

      if (
        toolResult.status === "denied" ||
        toolResult.status === "approval-required"
      ) {
        return {
          text: appendToolResult(
            baseText,
            buildBlockedToolExplanation(toolResult)
          ),
          citations: createCitations(
            baseText,
            input.contextSummary,
            toolCall,
            toolResult
          ),
          toolEvents: [toolResult]
        };
      }

      return {
        text: appendToolResult(baseText, toolResult.message),
        citations: createCitations(
          baseText,
          input.contextSummary,
          toolCall,
          toolResult
        ),
        toolEvents: [toolResult]
      };
    }

    return {
      text: response.text,
      citations: createCitations(response.text, input.contextSummary)
    };
  }

  async generateConversationTitle(
    input: ConversationTitleInput,
    settings: OpenVaultAiPluginSettings
  ): Promise<string> {
    const adapter = this.registry.get(input.providerId);
    if (!adapter) {
      throw new Error(`Provider '${input.providerId}' is not registered.`);
    }

    const response = await adapter.generateText(
      {
        modelId: input.modelId,
        systemPrompt:
          "You write concise conversation titles for the OpenVault AI chat app. Return only a short title of 2 to 6 words, with no quotes, no markdown, and no trailing punctuation.",
        userPrompt: [
          "Write a short title for this new chat.",
          `User: ${input.firstUserMessage}`,
          `Assistant: ${input.firstAssistantMessage}`
        ].join("\n\n"),
        temperature: 0.2
      },
      settings
    );

    const title = normalizeConversationTitle(response.text);
    if (!title) {
      throw new Error("Generated conversation title was empty.");
    }

    return title;
  }
}

export function buildUserPrompt(
  prompt: string,
  contextSummary: ResolvedContextSummary,
  recentMessages: ChatRequestInput["recentMessages"] = [],
  crossChatMemory: ChatRequestInput["crossChatMemory"] = [],
  allowedTools: ChatRequestInput["allowedTools"] = [],
  allowedSkills: ChatRequestInput["allowedSkills"] = []
): string {
  const groundingLines = [
    "Grounding instructions:",
    "- Prefer facts supported by the supplied context.",
    "- If the retrieved context is incomplete or conflicting, say so.",
    "- Do not claim a note was used unless it appears in the provided sources.",
    contextSummary.retrievalNotePaths &&
    contextSummary.retrievalNotePaths.length > 0
      ? `Retrieved support notes: ${contextSummary.retrievalNotePaths.join(", ")}`
      : "Retrieved support notes: none",
    contextSummary.explicitNotePaths &&
    contextSummary.explicitNotePaths.length > 0
      ? `Explicitly mentioned notes: ${contextSummary.explicitNotePaths.join(", ")}`
      : "Explicitly mentioned notes: none"
  ];
  const toolLines =
    allowedTools.length > 0
      ? [
          "Allowed tools:",
          ...allowedTools.map((tool) => `- ${tool.id}: ${tool.description}`),
          "Use a fenced TOOL_CALL JSON block only when a tool is necessary and the tool matches the requested task exactly."
        ]
      : ["Allowed tools: none"];
  const skillLines =
    allowedSkills.length > 0
      ? [
          "Allowed skills:",
          ...allowedSkills.flatMap((skill) => [
            `- ${skill.name} (${skill.id}): ${skill.description}`,
            skill.prompt
          ])
        ]
      : ["Allowed skills: none"];

  return [
    `Context scope: ${contextSummary.scope}`,
    `Context title: ${contextSummary.title}`,
    `Context description: ${contextSummary.description}`,
    `Referenced note paths: ${contextSummary.notePaths.length > 0 ? contextSummary.notePaths.join(", ") : "none"}`,
    ...groundingLines,
    recentMessages.length > 0
      ? [
          "Recent conversation:",
          recentMessages
            .map(
              (message) =>
                `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`
            )
            .join("\n\n"),
          "Interpret ambiguous follow-up terms using the recent conversation first, then the supplied note context. Stay on the current topic unless the user clearly changes it."
        ].join("\n\n")
      : "",
    crossChatMemory.length > 0
      ? [
          "Cross-chat memory:",
          crossChatMemory
            .map((memory) => `- ${memory.summary} (source: ${memory.path})`)
            .join("\n")
        ].join("\n\n")
      : "",
    toolLines.join("\n"),
    skillLines.join("\n\n"),
    "Context content:",
    contextSummary.promptContext,
    "User request:",
    prompt
  ].join("\n\n");
}

function createCitations(
  responseText: string,
  contextSummary: ResolvedContextSummary,
  toolCall?: ToolCallInput,
  toolResult?: ToolRunResult
): AssistantResponse["citations"] {
  const citations: AssistantResponse["citations"] = [];
  const normalizedResponse = normalizeCitationText(responseText);

  for (const path of contextSummary.explicitNotePaths ?? []) {
    if (responseSupportsPath(normalizedResponse, path)) {
      citations.push({ path, reason: "explicit" });
    }
  }

  for (const path of contextSummary.retrievalNotePaths ?? []) {
    const retrievalNote = contextSummary.retrievalNotes?.find(
      (note) => note.path === path
    );
    if (
      responseSupportsRetrievedNote(
        normalizedResponse,
        path,
        retrievalNote?.snippet
      ) &&
      !citations.some((citation) => citation.path === path)
    ) {
      citations.push({ path, reason: "retrieved" });
    }
  }

  for (const path of contextSummary.contextNotePaths ?? []) {
    if (
      responseSupportsPath(normalizedResponse, path) &&
      !citations.some((citation) => citation.path === path)
    ) {
      citations.push({ path, reason: "context" });
    }
  }

  const toolPath = extractToolPath(toolCall, toolResult);
  if (toolPath && !citations.some((citation) => citation.path === toolPath)) {
    citations.push({ path: toolPath, reason: "context" });
  }

  return citations;
}

function normalizeCitationText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9/ ._-]+/g, " ");
}

function responseSupportsPath(responseText: string, path: string): boolean {
  const normalizedPath = path.toLowerCase();
  const basename =
    path.split("/").pop()?.replace(/\.md$/i, "").toLowerCase() ??
    normalizedPath;
  const basenameTokens = basename
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  if (
    responseText.includes(normalizedPath) ||
    responseText.includes(basename)
  ) {
    return true;
  }

  if (basenameTokens.length === 0) {
    return false;
  }

  return basenameTokens.every((token) => responseText.includes(token));
}

function responseSupportsRetrievedNote(
  responseText: string,
  path: string,
  snippet?: string
): boolean {
  if (responseSupportsPath(responseText, path)) {
    return true;
  }

  if (!snippet) {
    return false;
  }

  const snippetTokens = normalizeCitationText(snippet)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
  if (snippetTokens.length === 0) {
    return false;
  }

  const overlapCount = snippetTokens.filter((token) =>
    responseText.includes(token)
  ).length;
  return overlapCount >= Math.min(3, snippetTokens.length);
}

function extractToolPath(
  toolCall?: ToolCallInput,
  toolResult?: ToolRunResult
): string | undefined {
  if (!toolCall || toolResult?.status !== "allowed") {
    return undefined;
  }

  const path = toolCall.input.path;
  return typeof path === "string" && path.trim() ? path : undefined;
}

function appendToolResult(text: string, toolMessage: string): string {
  return `${text}\n\nTool result: ${toolMessage}`.trim();
}

function stripToolCallBlocks(text: string): string {
  return text.replace(/```TOOL_CALL[\s\S]*?```/g, "").trim();
}

function buildToolFollowUpPrompt(
  prompt: string,
  contextSummary: ResolvedContextSummary,
  recentMessages: ChatRequestInput["recentMessages"],
  crossChatMemory: ChatRequestInput["crossChatMemory"],
  allowedTools: ChatRequestInput["allowedTools"],
  allowedSkills: ChatRequestInput["allowedSkills"],
  toolCall: ToolCallInput,
  toolOutput: string
): string {
  return [
    buildUserPrompt(
      prompt,
      contextSummary,
      recentMessages,
      crossChatMemory,
      allowedTools,
      allowedSkills
    ),
    "Tool call executed:",
    JSON.stringify(toolCall, null, 2),
    "Tool output:",
    toolOutput,
    "Now answer the user directly using the tool output and supplied context."
  ].join("\n\n");
}

function buildBlockedToolExplanation(toolResult: ToolRunResult): string {
  if (toolResult.status === "approval-required") {
    return `The agent requested tool '${toolResult.toolId}', but it requires explicit approval before it can run. ${toolResult.message}`;
  }

  return `The agent requested tool '${toolResult.toolId}', but it was blocked by policy. ${toolResult.message}`;
}

function parseToolCall(text: string): ToolCallInput | null {
  const match = text.match(/```TOOL_CALL\n([\s\S]*?)\n```/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("toolId" in parsed) ||
      typeof parsed.toolId !== "string" ||
      !("input" in parsed) ||
      typeof parsed.input !== "object" ||
      parsed.input === null ||
      Array.isArray(parsed.input)
    ) {
      return null;
    }

    return {
      toolId: parsed.toolId,
      input: parsed.input as Record<string, unknown>
    };
  } catch {
    return null;
  }
}

function normalizeConversationTitle(text: string): string {
  const candidate = text
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/^[#*\-\d.\s]+/, "")
    .replace(/[:.!?]+$/g, "")
    .split(/\r?\n/)[0]
    ?.trim();

  if (!candidate) {
    return "";
  }

  return candidate.slice(0, 80).trim();
}
