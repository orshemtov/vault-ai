import { App, TAbstractFile, TFile } from "obsidian";

const DEFAULT_RETRIEVAL_LIMIT = 5;
const MAX_NOTE_CHARS = 3000;
const MAX_SNIPPET_CHARS = 220;

export interface RetrievedNote {
  path: string;
  score: number;
  content: string;
  snippet: string;
}

export class RetrievalService {
  private readonly noteIndex = new Map<
    string,
    { path: string; basename: string; folderPath: string; content: string }
  >();
  private started = false;

  constructor(private readonly app?: App) {}

  async start(): Promise<void> {
    if (!this.app || this.started) {
      return;
    }

    await this.rebuildIndex();
    this.started = true;
    this.app.vault.on("create", (file) => {
      void this.indexAbstractFile(file);
    });
    this.app.vault.on("modify", (file) => {
      void this.indexAbstractFile(file);
    });
    this.app.vault.on("delete", (file) => {
      this.noteIndex.delete(file.path);
    });
    this.app.vault.on("rename", (file, oldPath) => {
      this.noteIndex.delete(oldPath);
      void this.indexAbstractFile(file);
    });
  }

  stop(): void {
    this.noteIndex.clear();
    this.started = false;
  }

  async retrieveRelevantNotes(options: {
    query: string;
    limit?: number;
    preferredPaths?: string[];
    excludedRoots?: string[];
  }): Promise<RetrievedNote[]> {
    if (!this.app) {
      return [];
    }

    const queryTokens = tokenize(options.query);
    if (queryTokens.length === 0) {
      return [];
    }

    const preferredPathSet = new Set(options.preferredPaths ?? []);
    const excludedRoots = options.excludedRoots ?? [];
    if (!this.started) {
      await this.rebuildIndex();
    }

    const rankedNotes = [...this.noteIndex.values()]
      .filter((note) => isIncludedPath(note.path, excludedRoots))
      .map((note) => {
        const score = scoreIndexedNote({
          note,
          query: options.query,
          queryTokens,
          isPreferred: preferredPathSet.has(note.path)
        });

        return score > 0
          ? {
              path: note.path,
              score,
              content: note.content.slice(0, MAX_NOTE_CHARS),
              snippet: createSnippet(note.content, options.query, queryTokens)
            }
          : null;
      });

    return rankedNotes
      .filter((note): note is RetrievedNote => note !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit ?? DEFAULT_RETRIEVAL_LIMIT);
  }

  async rebuildIndex(): Promise<void> {
    if (!this.app) {
      return;
    }

    const files = this.app.vault.getMarkdownFiles();
    const indexedNotes = await Promise.all(
      files.map(async (file) => this.readIndexedNote(file))
    );

    this.noteIndex.clear();
    for (const note of indexedNotes) {
      this.noteIndex.set(note.path, note);
    }
  }

  getIndexedNote(path: string) {
    return this.noteIndex.get(path) ?? null;
  }

  private async indexAbstractFile(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile) || file.extension !== "md") {
      return;
    }

    this.noteIndex.set(file.path, await this.readIndexedNote(file));
  }

  private async readIndexedNote(file: TFile) {
    const content = await this.app!.vault.cachedRead(file);
    return {
      path: file.path,
      basename: file.basename,
      folderPath: file.parent?.path ?? "",
      content
    };
  }
}

function scoreIndexedNote(options: {
  note: { path: string; basename: string; folderPath: string; content: string };
  query: string;
  queryTokens: string[];
  isPreferred: boolean;
}): number {
  const lowercasePath = options.note.path.toLowerCase();
  const lowercaseBasename = options.note.basename.toLowerCase();
  const lowercaseFolderPath = options.note.folderPath.toLowerCase();
  const lowercaseContent = options.note.content.toLowerCase();
  const normalizedQuery = options.query.toLowerCase().trim();

  let score = options.isPreferred ? 28 : 0;

  if (normalizedQuery.length >= 3) {
    if (lowercaseBasename.includes(normalizedQuery)) {
      score += 28;
    }

    if (lowercaseFolderPath.includes(normalizedQuery)) {
      score += 16;
    }

    if (lowercasePath.includes(normalizedQuery)) {
      score += 18;
    }

    if (lowercaseContent.includes(normalizedQuery)) {
      score += 14;
    }
  }

  for (const token of options.queryTokens) {
    if (lowercaseBasename.includes(token)) {
      score += 10;
    }

    if (lowercaseFolderPath.includes(token)) {
      score += 6;
    }

    if (lowercasePath.includes(token)) {
      score += 4;
    }

    score += Math.min(occurrenceCount(lowercaseContent, token), 4) * 2;
  }

  return score;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function isIncludedPath(path: string, excludedRoots: string[]): boolean {
  return !excludedRoots.some(
    (root) => path === root || path.startsWith(`${root}/`)
  );
}

function createSnippet(
  content: string,
  query: string,
  queryTokens: string[]
): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  const lowercase = normalized.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();

  let matchIndex =
    normalizedQuery.length >= 3 ? lowercase.indexOf(normalizedQuery) : -1;

  if (matchIndex === -1) {
    for (const token of queryTokens) {
      matchIndex = lowercase.indexOf(token);
      if (matchIndex !== -1) {
        break;
      }
    }
  }

  if (matchIndex === -1) {
    return normalized.slice(0, MAX_SNIPPET_CHARS);
  }

  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(normalized.length, start + MAX_SNIPPET_CHARS);
  const snippet = normalized.slice(start, end).trim();

  return start > 0 ? `...${snippet}` : snippet;
}

function occurrenceCount(haystack: string, token: string): number {
  let count = 0;
  let currentIndex = haystack.indexOf(token);

  while (currentIndex !== -1) {
    count += 1;
    currentIndex = haystack.indexOf(token, currentIndex + token.length);
  }

  return count;
}
