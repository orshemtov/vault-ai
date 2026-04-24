import { vi } from "vitest";
import { TFile } from "obsidian";
import { MemoryStorage } from "./memory-storage";

vi.mock("obsidian", () => ({
  App: class {},
  TFile: class {},
  normalizePath: (value: string) =>
    value.replace(/\\/g, "/").replace(/\/+/g, "/")
}));

describe("MemoryStorage", () => {
  it("saves and lists durable preference memories under AI/Memory", async () => {
    const app = createApp();
    const storage = new MemoryStorage(app as never, "AI/Memory");

    const saved = await storage.savePreference({
      summary: "User preference: prefer short bullet points.",
      details: "When you summarize things for me, prefer short bullet points.",
      sourceConversationPath: "AI/Conversations/test.md",
      tags: ["preference", "ask"]
    });

    expect(saved.path).toContain("AI/Memory/Profile/");

    const memories = await storage.listMemories();
    expect(memories).toHaveLength(1);
    expect(memories[0]?.summary).toContain("prefer short bullet points");
    expect(memories[0]?.sourceConversationPath).toBe(
      "AI/Conversations/test.md"
    );
  });

  it("saves, updates, and deletes fact and lesson memories", async () => {
    const app = createApp();
    const storage = new MemoryStorage(app as never, "AI/Memory");

    const fact = await storage.saveMemory({
      type: "fact",
      summary: "User works on warehouse notes",
      details: "The user frequently compares data warehouse technologies.",
      tags: ["warehouse"]
    });
    const lesson = await storage.saveMemory({
      type: "lesson",
      summary: "Ask for clarification on broad warehouse comparisons",
      details:
        "When the warehouse target set is unclear, ask which notes to compare.",
      tags: ["clarification"]
    });

    expect(fact.path).toContain("AI/Memory/Facts/");
    expect(lesson.path).toContain("AI/Memory/Lessons/");

    const updated = await storage.updateMemory(fact.id, {
      summary: "User often works on warehouse notes",
      tags: ["warehouse", "fact"]
    });
    expect(updated?.summary).toContain("often works");

    const deleted = await storage.deleteMemory(lesson.id);
    expect(deleted).toBe(true);

    const memories = await storage.listMemories();
    expect(memories).toHaveLength(1);
    expect(memories[0]?.type).toBe("fact");
  });
});

function createApp() {
  const fileMap = new Map<string, InstanceType<typeof TFile>>();
  const contentMap = new Map<string, string>();
  const folderSet = new Set<string>();

  return {
    vault: {
      getMarkdownFiles: () => [...fileMap.values()],
      getAbstractFileByPath: (path: string) =>
        fileMap.get(path) ?? (folderSet.has(path) ? { path } : null),
      cachedRead: async (file: { path: string }) =>
        contentMap.get(file.path) ?? "",
      createFolder: async (path: string) => {
        folderSet.add(path);
      },
      create: async (path: string, content: string) => {
        const file = createFile(path);
        fileMap.set(path, file);
        contentMap.set(path, content);
        return file;
      },
      modify: async (file: { path: string }, content: string) => {
        contentMap.set(file.path, content);
      },
      delete: async (file: { path: string }) => {
        fileMap.delete(file.path);
        contentMap.delete(file.path);
      }
    }
  };
}

function createFile(path: string) {
  const file = new TFile();
  Object.assign(file, {
    path,
    basename: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
    extension: "md",
    parent: { path: path.split("/").slice(0, -1).join("/") }
  });
  return file;
}
