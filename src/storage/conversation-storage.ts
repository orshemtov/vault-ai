import { App, TFile, normalizePath } from "obsidian";
import {
  createConversationFileName,
  createConversationSessionId,
  parseConversation,
  serializeConversation
} from "./conversation-format";
import type {
  PersistedConversation,
  SaveConversationInput
} from "./conversation-types";

export class ConversationStorage {
  constructor(
    private readonly app: App,
    private readonly conversationsRoot: string
  ) {}

  getConversationsRoot(): string {
    return this.conversationsRoot;
  }

  async loadConversation(path: string): Promise<PersistedConversation | null> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile) || file.extension !== "md") {
      return null;
    }

    const content = await this.app.vault.cachedRead(file);
    return parseConversation(content, file.path);
  }

  async saveConversation(
    input: SaveConversationInput,
    existingPath?: string | null
  ): Promise<PersistedConversation> {
    const now = new Date().toISOString();
    const existingConversation = existingPath
      ? await this.loadConversation(existingPath)
      : null;

    const path =
      existingConversation?.path ?? (await this.createConversationPath());
    const conversation: PersistedConversation = {
      sessionId:
        existingConversation?.sessionId ?? createConversationSessionId(),
      path,
      title: input.title?.trim() || existingConversation?.title || "New chat",
      createdAt: existingConversation?.createdAt ?? now,
      updatedAt: now,
      agentId: input.agentId,
      providerId: input.providerId,
      modelId: input.modelId,
      contextScope: input.contextScope,
      referencedNotes: input.referencedNotes,
      messages: input.messages
    };
    const content = serializeConversation(conversation);

    await this.ensureFolderExists();

    const existingFile = this.app.vault.getAbstractFileByPath(path);
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(path, content);
    }

    return conversation;
  }

  async listConversations(): Promise<PersistedConversation[]> {
    const normalizedRoot = normalizePath(this.conversationsRoot);
    const files = this.app.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          file.path === normalizedRoot ||
          file.path.startsWith(`${normalizedRoot}/`)
      );

    const conversations = await Promise.all(
      files.map(async (file) => {
        const content = await this.app.vault.cachedRead(file);
        return parseConversation(content, file.path);
      })
    );

    return conversations.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }

  private createConversationPath(): string {
    const fileName = createConversationFileName();
    const baseName = fileName.replace(/\.md$/, "");
    let candidate = normalizePath(`${this.conversationsRoot}/${fileName}`);
    let counter = 1;

    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = normalizePath(
        `${this.conversationsRoot}/${baseName}-${counter}.md`
      );
      counter += 1;
    }

    return candidate;
  }

  private async ensureFolderExists(): Promise<void> {
    const normalizedRoot = normalizePath(this.conversationsRoot);
    const segments = normalizedRoot.split("/").filter(Boolean);
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(currentPath)) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }
}
