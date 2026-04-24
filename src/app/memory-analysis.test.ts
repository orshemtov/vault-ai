import { createMessage } from "@ui/assistant-state";
import {
  extractPreferenceMemory,
  findLastSuccessfulAssistantMessage,
  proposeLongTermMemories
} from "./memory-analysis";

describe("memory analysis", () => {
  it("extracts durable preference memory from explicit preference phrasing", () => {
    expect(
      extractPreferenceMemory(
        "When you summarize things for me, prefer short bullet points."
      )
    ).toContain("prefer short bullet points");
  });

  it("proposes preference, fact, and lesson memories from a successful exchange", () => {
    const proposed = proposeLongTermMemories({
      userPrompt:
        "I often compare Redshift and Hive. When you summarize, prefer short bullet points.",
      assistantReply:
        "I should ask which warehouse notes you want compared if the target set is unclear.",
      contextNotePaths: ["Permanent/AWS Redshift.md"]
    });

    expect(proposed.map((memory) => memory.type)).toEqual([
      "preference",
      "fact",
      "lesson"
    ]);
  });

  it("finds the last successful assistant message", () => {
    const messages = [
      createMessage("assistant", "Thinking...", "pending"),
      createMessage("assistant", "Failed", "error"),
      createMessage("assistant", "Useful answer", "done")
    ];

    expect(findLastSuccessfulAssistantMessage(messages)?.text).toBe(
      "Useful answer"
    );
  });
});
