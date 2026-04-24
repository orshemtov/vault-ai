import { TFile } from "obsidian";
import { vi } from "vitest";
import { RetrievalService } from "./retrieval-service";

vi.mock("obsidian", () => ({
  App: class {},
  TAbstractFile: class {},
  TFile: class {}
}));

describe("RetrievalService", () => {
  it("ranks relevant notes and excludes configured roots", async () => {
    const app = createApp([
      {
        path: "Notes/Project.md",
        basename: "Project",
        content: "Project plan and roadmap"
      },
      {
        path: "Notes/Random.md",
        basename: "Random",
        content: "Completely unrelated content"
      },
      {
        path: "AI/Conversations/chat.md",
        basename: "chat",
        content: "project discussion"
      }
    ]);
    const service = new RetrievalService(app as never);
    await service.start();

    const results = await service.retrieveRelevantNotes({
      query: "project roadmap",
      excludedRoots: ["AI/Conversations"]
    });

    expect(results[0]?.path).toBe("Notes/Project.md");
    expect(results[0]?.snippet).toContain("Project plan and roadmap");
    expect(results.map((result) => result.path)).not.toContain(
      "AI/Conversations/chat.md"
    );
  });

  it("boosts preferred note paths", async () => {
    const app = createApp([
      { path: "Notes/Project.md", basename: "Project", content: "brief note" },
      {
        path: "Notes/Roadmap.md",
        basename: "Roadmap",
        content: "project roadmap details"
      }
    ]);
    const service = new RetrievalService(app as never);
    await service.start();

    const results = await service.retrieveRelevantNotes({
      query: "project roadmap",
      preferredPaths: ["Notes/Project.md"]
    });

    expect(results[0]?.path).toBe("Notes/Project.md");
  });

  it("updates the in-memory index when vault files change", async () => {
    const app = createMutableApp([
      {
        path: "Notes/Project.md",
        basename: "Project",
        content: "Project roadmap"
      }
    ]);
    const service = new RetrievalService(app as never);
    await service.start();

    await app.modifyFile("Notes/Project.md", "Project roadmap and milestones");

    const results = await service.retrieveRelevantNotes({
      query: "milestones",
      excludedRoots: []
    });

    expect(results[0]?.snippet).toContain("milestones");
  });

  it("boosts exact phrase and title matches over scattered token matches", async () => {
    const app = createApp([
      {
        path: "Projects/Home Gym.md",
        basename: "Home Gym",
        content: "Home gym setup with flooring and rack planning"
      },
      {
        path: "Daily/Today.md",
        basename: "Today",
        content: "I was home and went to the gym and later talked about setup"
      }
    ]);
    const service = new RetrievalService(app as never);
    await service.start();

    const results = await service.retrieveRelevantNotes({
      query: "home gym setup",
      excludedRoots: []
    });

    expect(results[0]?.path).toBe("Projects/Home Gym.md");
  });

  it("builds snippets around the best match region", async () => {
    const app = createApp([
      {
        path: "Notes/Long.md",
        basename: "Long",
        content:
          "intro text ".repeat(40) +
          "the exact warehouse comparison details appear here with redshift and hive" +
          " ending text".repeat(20)
      }
    ]);
    const service = new RetrievalService(app as never);
    await service.start();

    const results = await service.retrieveRelevantNotes({
      query: "warehouse comparison",
      excludedRoots: []
    });

    expect(results[0]?.snippet).toContain("warehouse comparison details");
  });
});

function createApp(
  files: Array<{ path: string; basename: string; content: string }>
) {
  const fileMap = new Map(files.map((file) => [file.path, createFile(file)]));
  const contentMap = new Map(files.map((file) => [file.path, file.content]));

  return {
    vault: {
      on: () => () => undefined,
      getMarkdownFiles: () => [...fileMap.values()],
      cachedRead: async (file: { path: string }) =>
        contentMap.get(file.path) ?? ""
    }
  };
}

function createMutableApp(
  files: Array<{ path: string; basename: string; content: string }>
) {
  const fileMap = new Map(files.map((file) => [file.path, createFile(file)]));
  const contentMap = new Map(files.map((file) => [file.path, file.content]));
  const listeners = new Map<string, Array<(file: { path: string }) => void>>();

  return {
    vault: {
      on: (event: string, callback: (file: { path: string }) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), callback]);
        return () => undefined;
      },
      getMarkdownFiles: () => [...fileMap.values()],
      cachedRead: async (file: { path: string }) =>
        contentMap.get(file.path) ?? ""
    },
    async modifyFile(path: string, content: string) {
      const file = fileMap.get(path);
      if (!file) {
        return;
      }

      contentMap.set(path, content);
      for (const callback of listeners.get("modify") ?? []) {
        await callback(file);
      }
    }
  };
}

function createFile(file: { path: string; basename: string; content: string }) {
  const note = new TFile();
  Object.assign(note, {
    path: file.path,
    basename: file.basename,
    extension: "md",
    parent: { path: file.path.split("/").slice(0, -1).join("/") }
  });
  return note;
}
