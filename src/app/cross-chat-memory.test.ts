import type { PersistedConversation } from "@storage/conversation-types";
import type { PersistedMemoryEntry } from "@storage/memory-types";
import { buildCrossChatMemory, truncateMemoryText } from "./cross-chat-memory";

describe("cross-chat memory", () => {
  it("keeps only relevant recent conversations for the same notes", () => {
    const conversations: PersistedConversation[] = [
      {
        sessionId: "1",
        path: "AI/Conversations/one.md",
        title: "One",
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:05:00.000Z",
        agentId: "ask",
        providerId: "openrouter",
        modelId: "openai/gpt-5.4",
        contextScope: "current-note",
        referencedNotes: ["Notes/Zettlekasten.md"],
        messages: [
          { role: "user", text: "Prefer short bullet points.", status: "done" },
          {
            role: "assistant",
            text: "I will keep summaries short and bulleted.",
            status: "done"
          }
        ]
      },
      {
        sessionId: "2",
        path: "AI/Conversations/two.md",
        title: "Two",
        createdAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:05:00.000Z",
        agentId: "ask",
        providerId: "openrouter",
        modelId: "openai/gpt-5.4",
        contextScope: "current-note",
        referencedNotes: ["Notes/Other.md"],
        messages: [
          { role: "user", text: "Unrelated", status: "done" },
          { role: "assistant", text: "Unrelated", status: "done" }
        ]
      }
    ];
    const memories: PersistedMemoryEntry[] = [
      {
        id: "memory-1",
        path: "AI/Memory/Profile/bullets.md",
        type: "preference",
        summary: "User preference: prefer short bullet points.",
        details:
          "When you summarize things for me, prefer short bullet points.",
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:05:00.000Z",
        tags: ["preference"]
      }
    ];

    const memory = buildCrossChatMemory(
      conversations,
      "Summarize",
      {
        scope: "current-note",
        title: "Zettlekasten",
        description: "Using the active note.",
        notePaths: ["Notes/Zettlekasten.md"],
        contextNotePaths: ["Notes/Zettlekasten.md"],
        promptContext: "Note content"
      },
      memories
    );

    expect(memory).toHaveLength(2);
    expect(memory[0]?.path).toBe("AI/Memory/Profile/bullets.md");
    expect(memory[1]?.path).toBe("AI/Conversations/one.md");
    expect(memory[0]?.summary.toLowerCase()).toContain(
      "prefer short bullet points"
    );
  });

  it("truncates long memory text cleanly", () => {
    expect(truncateMemoryText("a".repeat(300), 20)).toBe(
      "aaaaaaaaaaaaaaaaa..."
    );
  });

  it("extracts durable formatting preferences across chats", () => {
    const conversations: PersistedConversation[] = [
      {
        sessionId: "1",
        path: "AI/Conversations/prefs.md",
        title: "Prefs",
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:05:00.000Z",
        agentId: "ask",
        providerId: "openrouter",
        modelId: "openai/gpt-5.4",
        contextScope: "current-note",
        referencedNotes: [],
        messages: [
          {
            role: "user",
            text: "When you summarize things for me, prefer short bullet points.",
            status: "done"
          }
        ]
      }
    ];

    const memory = buildCrossChatMemory(conversations, "Summarize", {
      scope: "current-note",
      title: "Zettlekasten",
      description: "Using the active note.",
      notePaths: ["Notes/Zettlekasten.md"],
      contextNotePaths: ["Notes/Zettlekasten.md"],
      promptContext: "Note content"
    });

    expect(memory[0]?.summary).toContain("prefer short bullet points");
  });

  it("ranks long-term memories by relevance to the prompt", () => {
    const memories: PersistedMemoryEntry[] = [
      {
        id: "memory-1",
        path: "AI/Memory/Facts/warehouse.md",
        type: "fact",
        summary: "User compares warehouse technologies",
        details: "The user often compares Redshift, Snowflake, and Hive.",
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:05:00.000Z",
        tags: ["warehouse", "redshift"]
      },
      {
        id: "memory-2",
        path: "AI/Memory/Lessons/trips.md",
        type: "lesson",
        summary: "Ask follow-up questions on trip planning",
        details:
          "Trip planning questions often need date and budget clarification.",
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:05:00.000Z",
        tags: ["trip"]
      }
    ];

    const memory = buildCrossChatMemory(
      [],
      "Compare my warehouse notes",
      {
        scope: "current-note",
        title: "Data Warehouse",
        description: "Warehouse comparison work.",
        notePaths: [],
        contextNotePaths: [],
        promptContext: ""
      },
      memories
    );

    expect(memory[0]?.path).toBe("AI/Memory/Facts/warehouse.md");
  });
});
