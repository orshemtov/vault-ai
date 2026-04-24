import { App, TFile, normalizePath } from "obsidian";
import matter from "gray-matter";
import { z } from "zod";
import type { PersistedMemoryEntry } from "./memory-types";

const memoryFrontmatterSchema = z.object({
  type: z.literal("ai-memory"),
  id: z.string().min(1),
  memory_type: z.enum(["preference", "fact", "lesson"]),
  summary: z.string().min(1),
  created: z.union([z.string().min(1), z.date()]),
  updated: z.union([z.string().min(1), z.date()]),
  source_conversation: z.string().optional(),
  tags: z.array(z.string()).default([])
});

export class MemoryStorage {
  constructor(
    private readonly app: App,
    private readonly memoryRoot: string
  ) {}

  async listMemories(): Promise<PersistedMemoryEntry[]> {
    const normalizedRoot = normalizePath(this.memoryRoot);
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(`${normalizedRoot}/`));

    const memories = await Promise.all(
      files.map(async (file) => {
        try {
          return this.parseMemory(
            await this.app.vault.cachedRead(file),
            file.path
          );
        } catch {
          return null;
        }
      })
    );

    return memories
      .filter((entry): entry is PersistedMemoryEntry => entry !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async savePreference(input: {
    summary: string;
    details: string;
    sourceConversationPath?: string;
    tags?: string[];
  }): Promise<PersistedMemoryEntry> {
    return this.saveMemory({
      type: "preference",
      summary: input.summary,
      details: input.details,
      sourceConversationPath: input.sourceConversationPath,
      tags: input.tags
    });
  }

  async saveMemory(input: {
    type: PersistedMemoryEntry["type"];
    summary: string;
    details: string;
    sourceConversationPath?: string;
    tags?: string[];
  }): Promise<PersistedMemoryEntry> {
    const existing = (await this.listMemories()).find(
      (memory) =>
        memory.type === input.type &&
        memory.summary.toLowerCase() === input.summary.toLowerCase()
    );
    const now = new Date().toISOString();
    const entry: PersistedMemoryEntry = {
      id: existing?.id ?? createMemoryId(),
      path:
        existing?.path ??
        (await this.createMemoryPath(
          getMemoryNamespace(input.type),
          input.summary
        )),
      type: input.type,
      summary: input.summary,
      details: input.details,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sourceConversationPath:
        input.sourceConversationPath ?? existing?.sourceConversationPath,
      tags: [...new Set([...(existing?.tags ?? []), ...(input.tags ?? [])])]
    };

    await this.writeMemory(entry);
    return entry;
  }

  async updateMemory(
    id: string,
    updates: Partial<
      Pick<PersistedMemoryEntry, "summary" | "details" | "tags" | "type">
    >
  ): Promise<PersistedMemoryEntry | null> {
    const existing = (await this.listMemories()).find(
      (memory) => memory.id === id
    );
    if (!existing) {
      return null;
    }

    const nextType = updates.type ?? existing.type;
    const nextSummary = updates.summary ?? existing.summary;
    const nextPath =
      nextType === existing.type && nextSummary === existing.summary
        ? existing.path
        : await this.createMemoryPath(
            getMemoryNamespace(nextType),
            nextSummary
          );
    const entry: PersistedMemoryEntry = {
      ...existing,
      path: nextPath,
      type: nextType,
      summary: nextSummary,
      details: updates.details ?? existing.details,
      tags: updates.tags ?? existing.tags,
      updatedAt: new Date().toISOString()
    };

    await this.writeMemory(entry, existing.path);
    return entry;
  }

  async deleteMemory(id: string): Promise<boolean> {
    const existing = (await this.listMemories()).find(
      (memory) => memory.id === id
    );
    if (!existing) {
      return false;
    }

    const file = this.app.vault.getAbstractFileByPath(existing.path);
    if (!(file instanceof TFile)) {
      return false;
    }

    await this.app.vault.delete(file);
    return true;
  }

  private parseMemory(fileContent: string, path: string): PersistedMemoryEntry {
    const parsed = matter(fileContent);
    const frontmatter = memoryFrontmatterSchema.parse(parsed.data);

    return {
      id: frontmatter.id,
      path,
      type: frontmatter.memory_type,
      summary: frontmatter.summary,
      details: parsed.content.trim(),
      createdAt: normalizeDate(frontmatter.created),
      updatedAt: normalizeDate(frontmatter.updated),
      sourceConversationPath: frontmatter.source_conversation,
      tags: frontmatter.tags
    };
  }

  private async createMemoryPath(
    namespace: string,
    summary: string
  ): Promise<string> {
    const slug =
      summary
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "memory";
    const basePath = normalizePath(
      `${this.memoryRoot}/${namespace}/${slug}.md`
    );
    let candidate = basePath;
    let counter = 1;

    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = normalizePath(
        `${this.memoryRoot}/${namespace}/${slug}-${counter}.md`
      );
      counter += 1;
    }

    return candidate;
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const directory = path.split("/").slice(0, -1).join("/");
    const segments = normalizePath(directory).split("/").filter(Boolean);
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(currentPath)) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  private async writeMemory(
    entry: PersistedMemoryEntry,
    previousPath?: string
  ): Promise<void> {
    await this.ensureFolderExists(entry.path);
    const content = serializeMemory(entry);
    const existingFile = this.app.vault.getAbstractFileByPath(entry.path);
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(entry.path, content);
    }

    if (previousPath && previousPath !== entry.path) {
      const previousFile = this.app.vault.getAbstractFileByPath(previousPath);
      if (previousFile instanceof TFile) {
        await this.app.vault.delete(previousFile);
      }
    }
  }
}

function serializeMemory(entry: PersistedMemoryEntry): string {
  const frontmatter = {
    type: "ai-memory",
    id: entry.id,
    memory_type: entry.type,
    summary: entry.summary,
    created: entry.createdAt,
    updated: entry.updatedAt,
    tags: entry.tags
  } as Record<string, unknown>;

  if (entry.sourceConversationPath) {
    frontmatter.source_conversation = entry.sourceConversationPath;
  }

  return matter.stringify(entry.details.trim(), frontmatter);
}

function normalizeDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function createMemoryId(): string {
  return `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getMemoryNamespace(type: PersistedMemoryEntry["type"]): string {
  switch (type) {
    case "preference":
      return "Profile";
    case "fact":
      return "Facts";
    case "lesson":
      return "Lessons";
  }
}
