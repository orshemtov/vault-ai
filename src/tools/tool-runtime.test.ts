import { vi } from "vitest";
import { BUILT_IN_AGENTS } from "../agents/built-in-agents";
import { ToolRegistry } from "./tool-registry";
import { ToolRuntime } from "./tool-runtime";
import { TFile } from "obsidian";

vi.mock("obsidian", () => ({
  App: class {},
  MarkdownView: class {},
  TFile: class {},
  normalizePath: (value: string) =>
    value.replace(/\\/g, "/").replace(/\/+/g, "/")
}));

describe("ToolRuntime", () => {
  it("denies blocked tools for the ask agent", async () => {
    const runtime = new ToolRuntime(createApp() as never, new ToolRegistry());

    const result = await runtime.runTool(BUILT_IN_AGENTS[0], {
      toolId: "update-note",
      input: {
        path: "Notes/Test.md",
        content: "Updated"
      }
    });

    expect(result.status).toBe("denied");
    expect(result.message).toContain("blocked by policy");
  });

  it("allows read tools for the ask agent", async () => {
    const runtime = new ToolRuntime(createApp() as never, new ToolRegistry());

    const result = await runtime.runTool(BUILT_IN_AGENTS[0], {
      toolId: "read-note",
      input: {
        path: "Notes/Test.md"
      }
    });

    expect(result.status).toBe("allowed");
    expect(result.output).toContain("Hello world");
  });

  it("returns current local date and timezone", async () => {
    const runtime = new ToolRuntime(createApp() as never, new ToolRegistry());

    const result = await runtime.runTool(BUILT_IN_AGENTS[0], {
      toolId: "get-current-date",
      input: {}
    });

    expect(result.status).toBe("allowed");
    expect(result.output).toContain("Tool 'get-current-date' completed.");
    expect(result.output).toContain("ISO:");
    expect(result.output).toContain("Timezone:");
  });

  it("lists and saves memories through explicit memory tools", async () => {
    const runtime = new ToolRuntime(createApp() as never, new ToolRegistry());

    const saveResult = await runtime.runTool(BUILT_IN_AGENTS[0], {
      toolId: "save-memory",
      input: {
        type: "fact",
        summary: "User compares warehouse technologies",
        details: "The user regularly compares Redshift, Hive, and Snowflake.",
        tags: ["warehouse"]
      }
    });

    expect(saveResult.status).toBe("allowed");
    expect(saveResult.output).toContain("Saved:");

    const listResult = await runtime.runTool(BUILT_IN_AGENTS[0], {
      toolId: "list-memories",
      input: {
        query: "warehouse"
      }
    });

    expect(listResult.status).toBe("allowed");
    expect(listResult.output).toContain("warehouse technologies");
  });

  it("updates memories through the explicit memory tool", async () => {
    const app = createApp();
    const runtime = new ToolRuntime(app as never, new ToolRegistry());
    const pluginMemory = await app.saveLongTermMemory({
      type: "lesson",
      summary: "Ask for clarification",
      details: "Ask for clarification when the target note set is broad."
    });

    const result = await runtime.runTool(BUILT_IN_AGENTS[0], {
      toolId: "update-memory",
      input: {
        id: pluginMemory?.id,
        summary: "Ask for clarification on broad note sets"
      }
    });

    expect(result.status).toBe("allowed");
    expect(result.output).toContain("Updated:");
  });

  it("returns approval-required for tools that require approval", async () => {
    const registry = new ToolRegistry();
    const originalTool = registry.getToolById("read-note");
    expect(originalTool).not.toBeNull();

    vi.spyOn(registry, "getToolById").mockReturnValue({
      ...originalTool!,
      requiresApproval: true
    });

    const runtime = new ToolRuntime(createApp() as never, registry);
    const result = await runtime.runTool(BUILT_IN_AGENTS[0], {
      toolId: "read-note",
      input: {
        path: "Notes/Test.md"
      }
    });

    expect(result.status).toBe("approval-required");
  });
});

function createApp() {
  const fileMap = new Map([["Notes/Test.md", createFile("Notes/Test.md")]]);
  const contentMap = new Map([["Notes/Test.md", "Hello world"]]);
  const memoryMap = new Map();

  return {
    workspace: {
      getActiveViewOfType: () => null
    },
    metadataCache: {
      getFileCache: () => null
    },
    fileManager: {
      processFrontMatter: async () => undefined
    },
    listLongTermMemories: async () => [...memoryMap.values()],
    saveLongTermMemory: async (input: {
      type: "preference" | "fact" | "lesson";
      summary: string;
      details: string;
      tags?: string[];
    }) => {
      const memory = {
        id: `memory-${memoryMap.size + 1}`,
        path: `AI/Memory/${input.type}/${memoryMap.size + 1}.md`,
        type: input.type,
        summary: input.summary,
        details: input.details,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: input.tags ?? []
      };
      memoryMap.set(memory.id, memory);
      return memory;
    },
    updateLongTermMemory: async (
      id: string,
      updates: { summary?: string; details?: string; tags?: string[] }
    ) => {
      const existing = memoryMap.get(id);
      if (!existing) {
        return null;
      }

      const updated = { ...existing, ...updates };
      memoryMap.set(id, updated);
      return updated;
    },
    deleteLongTermMemory: async (id: string) => memoryMap.delete(id),
    vault: {
      getMarkdownFiles: () => [...fileMap.values()],
      getAbstractFileByPath: (path: string) => fileMap.get(path) ?? null,
      cachedRead: async (file: { path: string }) =>
        contentMap.get(file.path) ?? "",
      create: async (path: string, content: string) => {
        const file = createFile(path);
        fileMap.set(path, file);
        contentMap.set(path, content);
        return file;
      },
      modify: async (file: { path: string }, content: string) => {
        contentMap.set(file.path, content);
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
