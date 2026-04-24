import type { ResolvedContextSummary } from "@core/context-types";
import type { PersistedConversation } from "@storage/conversation-types";
import type { PersistedMemoryEntry } from "@storage/memory-types";
import { extractPreferenceMemory } from "@app/memory-analysis";

export interface CrossChatMemoryEntry {
  path: string;
  summary: string;
}

export function buildCrossChatMemory(
  conversations: PersistedConversation[],
  prompt: string,
  contextSummary: ResolvedContextSummary,
  longTermMemories: PersistedMemoryEntry[] = []
): CrossChatMemoryEntry[] {
  const queryTokens = tokenizeMemoryQuery(
    `${prompt} ${contextSummary.title} ${contextSummary.description} ${contextSummary.notePaths.join(" ")}`
  );
  const currentContextPaths = new Set(contextSummary.notePaths);
  const relevantConversations = conversations
    .filter((conversation) =>
      conversation.referencedNotes.some((path) => currentContextPaths.has(path))
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const contextualMemory = relevantConversations
    .slice(0, 2)
    .map((conversation) => {
      const userPrompt = conversation.messages.find(
        (message) => message.role === "user"
      )?.text;
      const assistantReply = conversation.messages.find(
        (message) => message.role === "assistant" && message.status !== "error"
      )?.text;

      return {
        path: conversation.path,
        summary: [
          `Earlier chat about ${conversation.referencedNotes.join(", ") || prompt}.`,
          userPrompt ? `User asked: ${userPrompt}` : null,
          assistantReply
            ? `Assistant answered: ${truncateMemoryText(assistantReply)}`
            : null
        ]
          .filter((value): value is string => Boolean(value))
          .join(" ")
      };
    })
    .filter((memory) => memory.summary.trim().length > 0);
  const preferenceMemory = conversations
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.role === "user")
        .map((message) => ({
          path: conversation.path,
          preference: extractPreferenceMemory(message.text)
        }))
    )
    .filter(
      (
        entry
      ): entry is {
        path: string;
        preference: string;
      } => Boolean(entry.preference)
    )
    .slice(0, 2)
    .map((entry) => ({
      path: entry.path,
      summary: entry.preference
    }));

  const vaultMemory = longTermMemories
    .map((memory) => ({
      memory,
      score: scoreMemory(memory, queryTokens)
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ memory }) => ({
      path: memory.path,
      summary: `${memory.summary}. ${memory.details}`.trim()
    }));

  return [...vaultMemory, ...preferenceMemory, ...contextualMemory]
    .filter(
      (entry, index, items) =>
        items.findIndex((candidate) => candidate.summary === entry.summary) ===
        index
    )
    .slice(0, 3);
}

export function truncateMemoryText(text: string, limit = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 3).trimEnd()}...`;
}

function scoreMemory(
  memory: PersistedMemoryEntry,
  queryTokens: string[]
): number {
  const haystack =
    `${memory.type} ${memory.summary} ${memory.details} ${memory.tags.join(" ")}`.toLowerCase();
  return queryTokens.reduce(
    (score, token) => {
      if (haystack.includes(token)) {
        return score + 2;
      }

      return score;
    },
    memory.type === "preference" ? 1 : 0
  );
}

function tokenizeMemoryQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}
