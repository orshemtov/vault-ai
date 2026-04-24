import { providerIdSchema } from "../app/settings";
import matter from "gray-matter";
import { z } from "zod";
import type {
  AssistantCitation,
  AssistantToolEvent
} from "@core/assistant-response";
import type {
  PersistedConversation,
  StoredConversationMessage
} from "./conversation-types";

const transcriptMarker = "VAULT_AI_TRANSCRIPT_V1";

const conversationFrontmatterSchema = z.object({
  type: z.literal("ai-conversation"),
  session_id: z.string().min(1),
  title: z.string().min(1).default("New chat"),
  created: z.union([z.string().min(1), z.date()]).transform(normalizeDateValue),
  updated: z.union([z.string().min(1), z.date()]).transform(normalizeDateValue),
  agent: z.string().min(1),
  provider: providerIdSchema,
  model: z.string().min(1),
  context_scope: z.enum(["current-note", "selection", "whole-vault"]),
  referenced_notes: z.array(z.string()).default([])
});

const citationSchema = z.object({
  path: z.string().min(1),
  reason: z.enum(["retrieved", "explicit", "context"])
});

const toolEventSchema = z.object({
  toolId: z.string().min(1),
  status: z.enum(["allowed", "denied", "approval-required"]),
  message: z.string().min(1),
  output: z.string().optional()
});

const storedMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  citations: z.array(citationSchema).optional(),
  toolEvents: z.array(toolEventSchema).optional(),
  status: z.enum(["error", "done"]).optional()
});

const transcriptSchema = z.array(storedMessageSchema);

export function serializeConversation(
  conversation: PersistedConversation
): string {
  return matter.stringify(formatConversationBody(conversation.messages), {
    type: "ai-conversation",
    session_id: conversation.sessionId,
    title: conversation.title,
    created: conversation.createdAt,
    updated: conversation.updatedAt,
    agent: conversation.agentId,
    provider: conversation.providerId,
    model: conversation.modelId,
    context_scope: conversation.contextScope,
    referenced_notes: conversation.referencedNotes
  });
}

export function parseConversation(
  fileContent: string,
  path: string
): PersistedConversation {
  const parsed = matter(fileContent);
  const frontmatter = conversationFrontmatterSchema.parse(parsed.data);

  return {
    sessionId: frontmatter.session_id,
    path,
    title: frontmatter.title,
    createdAt: frontmatter.created,
    updatedAt: frontmatter.updated,
    agentId: frontmatter.agent,
    providerId: frontmatter.provider,
    modelId: frontmatter.model,
    contextScope: frontmatter.context_scope,
    referencedNotes: frontmatter.referenced_notes,
    messages: parseConversationBody(parsed.content)
  };
}

export function isConversationPath(
  path: string,
  conversationsRoot: string
): boolean {
  return path === conversationsRoot || path.startsWith(`${conversationsRoot}/`);
}

export function createConversationFileName(date = new Date()): string {
  return `${date
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.(\d{3})Z$/, "-$1Z")}.md`;
}

export function createConversationSessionId(date = new Date()): string {
  return `session-${date.toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatConversationBody(messages: StoredConversationMessage[]): string {
  const transcript = encodeTranscript(messages);
  return `<!-- ${transcriptMarker}\n${transcript}\n-->`;
}

function parseConversationBody(body: string): StoredConversationMessage[] {
  const transcriptMatch = body.match(
    new RegExp(
      `^<!-- ${transcriptMarker}\\n([A-Za-z0-9+/=\\r\\n]+)\\n-->$`,
      "m"
    )
  );
  if (transcriptMatch) {
    return decodeTranscript(transcriptMatch[1]);
  }

  const sections = body
    .split(/^## /m)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section) => {
    const [heading, ...rest] = section.split("\n\n");
    const role = heading === "User" ? "user" : "assistant";
    const block = rest.join("\n\n").trim();
    const statusMatch = block.match(
      /^(?:_Status: (error)_\n\n)?(?:_Citations: ([^\n]+)_\n\n)?(?:_Tools: ([^\n]+)_\n\n)?([\s\S]*)$/
    );

    if (statusMatch) {
      return {
        role,
        status: (statusMatch[1] as "error" | undefined) ?? "done",
        citations: statusMatch[2]
          ? formatLegacyCitations(statusMatch[2])
          : undefined,
        toolEvents: statusMatch[3]
          ? formatLegacyToolEvents(statusMatch[3])
          : undefined,
        text: statusMatch[4].trim()
      };
    }

    return {
      role,
      status: "done",
      text: block
    };
  });
}

function encodeTranscript(messages: StoredConversationMessage[]): string {
  return Buffer.from(JSON.stringify(messages), "utf8").toString("base64");
}

function decodeTranscript(encoded: string): StoredConversationMessage[] {
  const json = Buffer.from(encoded.replace(/\s+/g, ""), "base64").toString(
    "utf8"
  );
  return transcriptSchema.parse(JSON.parse(json));
}

function formatLegacyCitations(paths: string): AssistantCitation[] {
  return paths
    .split(", ")
    .map((path) => ({ path, reason: "retrieved" as const }));
}

function formatLegacyToolEvents(entries: string): AssistantToolEvent[] {
  return entries.split(", ").map((entry) => {
    const [toolId, status] = entry.split(":");
    return {
      toolId,
      status: status as AssistantToolEvent["status"],
      message: `${toolId} ${status}`
    };
  });
}

function normalizeDateValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
