import type { AgentDefinition } from "@agents/agent-types";
import type { OpenVaultAiPlugin } from "@app/plugin";
import { App, MarkdownView, TFile, normalizePath } from "obsidian";
import { canAgentUseTool } from "./tool-permissions";
import { ToolRegistry } from "./tool-registry";
import type { ToolDefinition } from "./tool-types";

export interface ToolCallInput {
  toolId: string;
  input: Record<string, unknown>;
}

export type ToolRunStatus = "allowed" | "denied" | "approval-required";

export interface ToolRunResult {
  status: ToolRunStatus;
  toolId: string;
  message: string;
  output?: string;
}

export class ToolRuntime {
  constructor(
    private readonly app: App,
    private readonly registry: ToolRegistry
  ) {}

  async runTool(
    agent: AgentDefinition,
    call: ToolCallInput
  ): Promise<ToolRunResult> {
    const tool = this.registry.getToolById(call.toolId);
    if (!tool) {
      return {
        status: "denied",
        toolId: call.toolId,
        message: `Tool '${call.toolId}' is not registered.`
      };
    }

    if (!canAgentUseTool(agent, tool)) {
      return {
        status: "denied",
        toolId: tool.id,
        message: `Tool '${tool.id}' is blocked by policy for agent '${agent.id}'.`
      };
    }

    if (tool.requiresApproval) {
      return {
        status: "approval-required",
        toolId: tool.id,
        message: `Tool '${tool.id}' requires explicit approval before it can run.`
      };
    }

    const output = await this.executeTool(tool, call.input);
    return {
      status: "allowed",
      toolId: tool.id,
      message: `Tool '${tool.id}' completed successfully.`,
      output
    };
  }

  private async executeTool(
    tool: ToolDefinition,
    input: Record<string, unknown>
  ): Promise<string> {
    switch (tool.id) {
      case "get-current-date":
        return this.getCurrentDate();
      case "list-memories":
        return this.listMemories(getOptionalString(input, "query") ?? "");
      case "save-memory":
        return this.saveMemory(
          requireMemoryType(input, "type"),
          requireString(input, "summary"),
          requireString(input, "details"),
          getOptionalStringArray(input, "tags") ?? []
        );
      case "update-memory":
        return this.updateMemory(
          requireString(input, "id"),
          getOptionalString(input, "summary"),
          getOptionalString(input, "details"),
          getOptionalStringArray(input, "tags"),
          getOptionalMemoryType(input, "type")
        );
      case "delete-memory":
        return this.deleteMemory(requireString(input, "id"));
      case "get-active-note":
        return this.getActiveNote();
      case "get-selection":
        return this.getSelection();
      case "read-note":
        return this.readNote(requireString(input, "path"));
      case "search-notes":
        return this.searchNotes(
          requireString(input, "query"),
          getOptionalNumber(input, "limit")
        );
      case "list-notes-in-folder":
        return this.listNotesInFolder(requireString(input, "folder"));
      case "create-note":
        return this.createNote(
          requireString(input, "path"),
          getOptionalString(input, "content") ?? ""
        );
      case "append-note":
        return this.appendNote(
          requireString(input, "path"),
          requireString(input, "content")
        );
      case "update-note":
        return this.updateNote(
          requireString(input, "path"),
          requireString(input, "content")
        );
      case "read-frontmatter":
        return this.readFrontmatter(requireString(input, "path"));
      case "update-frontmatter":
        return this.updateFrontmatter(
          requireString(input, "path"),
          requireObject(input, "fields")
        );
      default:
        throw new Error(`Tool '${tool.id}' does not have an executor.`);
    }
  }

  private async getCurrentDate(): Promise<string> {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return formatToolResult("get-current-date", [
      `ISO: ${now.toISOString()}`,
      `Local date: ${now.toLocaleDateString()}`,
      `Local time: ${now.toLocaleTimeString()}`,
      `Timezone: ${timezone}`
    ]);
  }

  private async listMemories(query: string): Promise<string> {
    const plugin = this.app as App & Partial<OpenVaultAiPlugin>;
    const memories = (await plugin.listLongTermMemories?.()) ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? memories.filter((memory) =>
          `${memory.summary}\n${memory.details}\n${memory.tags.join(" ")}`
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : memories;

    return formatToolResult("list-memories", [
      `Matches: ${filtered.length}`,
      ...filtered.map(
        (memory) =>
          `${memory.id} | ${memory.type} | ${memory.summary} | ${memory.path}`
      )
    ]);
  }

  private async saveMemory(
    type: "preference" | "fact" | "lesson",
    summary: string,
    details: string,
    tags: string[]
  ): Promise<string> {
    const plugin = this.app as App & Partial<OpenVaultAiPlugin>;
    const memory = await plugin.saveLongTermMemory?.({
      type,
      summary,
      details,
      tags
    });
    if (!memory) {
      throw new Error("Long-term memory storage is not available.");
    }

    return formatToolResult("save-memory", [
      `Saved: ${memory.id}`,
      `Path: ${memory.path}`,
      `Type: ${memory.type}`,
      `Summary: ${memory.summary}`
    ]);
  }

  private async updateMemory(
    id: string,
    summary: string | null,
    details: string | null,
    tags: string[] | null,
    type: "preference" | "fact" | "lesson" | null
  ): Promise<string> {
    const plugin = this.app as App & Partial<OpenVaultAiPlugin>;
    const memory = await plugin.updateLongTermMemory?.(id, {
      ...(summary ? { summary } : {}),
      ...(details ? { details } : {}),
      ...(tags ? { tags } : {}),
      ...(type ? { type } : {})
    });
    if (!memory) {
      throw new Error(`Memory '${id}' was not found.`);
    }

    return formatToolResult("update-memory", [
      `Updated: ${memory.id}`,
      `Path: ${memory.path}`,
      `Summary: ${memory.summary}`
    ]);
  }

  private async deleteMemory(id: string): Promise<string> {
    const plugin = this.app as App & Partial<OpenVaultAiPlugin>;
    const deleted = await plugin.deleteLongTermMemory?.(id);
    if (!deleted) {
      throw new Error(`Memory '${id}' was not found.`);
    }

    return formatToolResult("delete-memory", [`Deleted: ${id}`]);
  }

  private async getActiveNote(): Promise<string> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (!file) {
      throw new Error("No active Markdown note is open.");
    }

    const content = await this.app.vault.cachedRead(file);
    return formatToolResult("get-active-note", [
      `Path: ${file.path}`,
      "Content:",
      content
    ]);
  }

  private async getSelection(): Promise<string> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    const selection = view?.editor?.getSelection()?.trim() ?? "";

    if (!file) {
      throw new Error("No active Markdown note is open.");
    }

    if (!selection) {
      throw new Error(`No text is selected in '${file.path}'.`);
    }

    return formatToolResult("get-selection", [
      `Path: ${file.path}`,
      "Selection:",
      selection
    ]);
  }

  private async readNote(path: string): Promise<string> {
    const file = this.getMarkdownFile(path);
    const content = await this.app.vault.cachedRead(file);
    return formatToolResult("read-note", [
      `Path: ${file.path}`,
      "Content:",
      content
    ]);
  }

  private async searchNotes(query: string, limit = 10): Promise<string> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      throw new Error("Tool input 'query' must not be empty.");
    }

    const files = this.app.vault.getMarkdownFiles();
    const matches: string[] = [];

    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const haystack = `${file.path}\n${content}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        matches.push(file.path);
      }

      if (matches.length >= limit) {
        break;
      }
    }

    return formatToolResult("search-notes", [
      `Query: ${query}`,
      `Matches: ${matches.length > 0 ? matches.join(", ") : "none"}`
    ]);
  }

  private async listNotesInFolder(folder: string): Promise<string> {
    const normalizedFolder = normalizeFolder(folder);
    const matches = this.app.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          file.path.startsWith(`${normalizedFolder}/`) ||
          file.parent?.path === normalizedFolder
      )
      .map((file) => file.path)
      .sort((left, right) => left.localeCompare(right));

    return formatToolResult("list-notes-in-folder", [
      `Folder: ${normalizedFolder}`,
      `Matches: ${matches.length > 0 ? matches.join(", ") : "none"}`
    ]);
  }

  private async createNote(path: string, content: string): Promise<string> {
    const normalizedPath = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing) {
      throw new Error(`A file already exists at '${normalizedPath}'.`);
    }

    const file = await this.app.vault.create(normalizedPath, content);
    return formatToolResult("create-note", [`Created: ${file.path}`]);
  }

  private async appendNote(path: string, content: string): Promise<string> {
    const file = this.getMarkdownFile(path);
    const existing = await this.app.vault.cachedRead(file);
    const nextContent =
      existing.length > 0 ? `${existing}\n${content}` : content;
    await this.app.vault.modify(file, nextContent);
    return formatToolResult("append-note", [`Updated: ${file.path}`]);
  }

  private async updateNote(path: string, content: string): Promise<string> {
    const file = this.getMarkdownFile(path);
    await this.app.vault.modify(file, content);
    return formatToolResult("update-note", [`Updated: ${file.path}`]);
  }

  private async readFrontmatter(path: string): Promise<string> {
    const file = this.getMarkdownFile(path);
    const frontmatter =
      this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    return formatToolResult("read-frontmatter", [
      `Path: ${file.path}`,
      "Frontmatter:",
      JSON.stringify(frontmatter, null, 2)
    ]);
  }

  private async updateFrontmatter(
    path: string,
    fields: Record<string, unknown>
  ): Promise<string> {
    const file = this.getMarkdownFile(path);
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      for (const [key, value] of Object.entries(fields)) {
        frontmatter[key] = value;
      }
    });

    return formatToolResult("update-frontmatter", [`Updated: ${file.path}`]);
  }

  private getMarkdownFile(path: string): TFile {
    const normalizedPath = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error(`Markdown note '${normalizedPath}' was not found.`);
    }

    return file;
  }
}

function formatToolResult(toolId: string, lines: string[]): string {
  return [`Tool '${toolId}' completed.`, ...lines].join("\n\n");
}

function normalizeFolder(folder: string): string {
  return normalizePath(folder).replace(/\/$/, "");
}

function requireString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Tool input '${key}' must be a non-empty string.`);
  }

  return value;
}

function getOptionalString(
  input: Record<string, unknown>,
  key: string
): string | null {
  const value = input[key];
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Tool input '${key}' must be a string.`);
  }

  return value;
}

function getOptionalNumber(
  input: Record<string, unknown>,
  key: string
): number | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    throw new Error(`Tool input '${key}' must be a positive number.`);
  }

  return Math.floor(value);
}

function getOptionalStringArray(
  input: Record<string, unknown>,
  key: string
): string[] | null {
  const value = input[key];
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Tool input '${key}' must be an array of strings.`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function requireObject(
  input: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = input[key];
  if (!isPlainObject(value)) {
    throw new Error(`Tool input '${key}' must be a JSON object.`);
  }

  return value;
}

function requireMemoryType(
  input: Record<string, unknown>,
  key: string
): "preference" | "fact" | "lesson" {
  const value = input[key];
  if (value !== "preference" && value !== "fact" && value !== "lesson") {
    throw new Error(
      `Tool input '${key}' must be one of: preference, fact, lesson.`
    );
  }

  return value;
}

function getOptionalMemoryType(
  input: Record<string, unknown>,
  key: string
): "preference" | "fact" | "lesson" | null {
  const value = input[key];
  if (value === undefined) {
    return null;
  }

  return requireMemoryType(input, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
