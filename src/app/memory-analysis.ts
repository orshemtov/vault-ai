import type { AssistantMessage } from "@ui/assistant-state";
import type { PersistedMemoryEntry } from "@storage/memory-types";

export interface ProposedMemoryEntry {
  type: PersistedMemoryEntry["type"];
  summary: string;
  details: string;
  tags: string[];
}

export function extractPreferenceMemory(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const patterns = [
    /when you ([^.?!]+), prefer ([^.?!]+)/i,
    /prefer ([^.?!]+) when you ([^.?!]+)/i,
    /please always ([^.?!]+)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    return `User preference: ${match[0]}.`;
  }

  return null;
}

export function proposeLongTermMemories(options: {
  userPrompt: string;
  assistantReply: string;
  contextNotePaths: string[];
}): ProposedMemoryEntry[] {
  const proposed: ProposedMemoryEntry[] = [];
  const preferenceSummary = extractPreferenceMemory(options.userPrompt);
  if (preferenceSummary) {
    proposed.push({
      type: "preference",
      summary: preferenceSummary,
      details: options.userPrompt,
      tags: [
        "preference",
        ...deriveTags(options.contextNotePaths, options.userPrompt)
      ]
    });
  }

  const factSummary = extractFactMemory(
    options.userPrompt,
    options.contextNotePaths
  );
  if (factSummary) {
    proposed.push({
      type: "fact",
      summary: factSummary,
      details: options.userPrompt,
      tags: [
        "fact",
        ...deriveTags(options.contextNotePaths, options.userPrompt)
      ]
    });
  }

  const lessonSummary = extractLessonMemory(options.assistantReply);
  if (lessonSummary) {
    proposed.push({
      type: "lesson",
      summary: lessonSummary,
      details: options.assistantReply,
      tags: [
        "lesson",
        ...deriveTags(options.contextNotePaths, options.assistantReply)
      ]
    });
  }

  return dedupeProposedMemories(proposed);
}

export function findLastSuccessfulAssistantMessage(
  messages: AssistantMessage[]
): AssistantMessage | null {
  return (
    [...messages]
      .reverse()
      .find(
        (message) => message.role === "assistant" && message.status === "done"
      ) ?? null
  );
}

function extractFactMemory(
  text: string,
  contextNotePaths: string[]
): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const patterns = [
    /i (?:work|am working|focus) on ([^.?!]+)/i,
    /i often compare ([^.?!]+)/i,
    /my main project is ([^.?!]+)/i,
    /this note is about ([^.?!]+)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const subject = match[1]?.trim();
    if (!subject) {
      continue;
    }

    const sourceHint = contextNotePaths[0]
      ?.split("/")
      .pop()
      ?.replace(/\.md$/, "");
    return sourceHint
      ? `User fact: ${sourceHint} context involves ${subject}.`
      : `User fact: ${subject}.`;
  }

  return null;
}

function extractLessonMemory(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const patterns = [
    /i need to ask ([^.?!]+)/i,
    /need to clarify ([^.?!]+)/i,
    /should ask ([^.?!]+)/i,
    /it would help to clarify ([^.?!]+)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    return `Lesson: ${match[0].replace(/^i /i, "")}.`;
  }

  return null;
}

function deriveTags(notePaths: string[], text: string): string[] {
  const noteTags = notePaths
    .flatMap((path) => path.split("/"))
    .map((segment) => segment.replace(/\.md$/, "").toLowerCase())
    .filter((segment) => segment.length >= 3);
  const textTags = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5)
    .slice(0, 5);

  return [...new Set([...noteTags, ...textTags])].slice(0, 8);
}

function dedupeProposedMemories(
  entries: ProposedMemoryEntry[]
): ProposedMemoryEntry[] {
  return entries.filter(
    (entry, index, items) =>
      items.findIndex(
        (candidate) =>
          candidate.type === entry.type && candidate.summary === entry.summary
      ) === index
  );
}
