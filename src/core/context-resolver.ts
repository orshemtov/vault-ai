import type { ContextScope, ResolvedContextSummary } from "@core/context-types";
import { truncateSelection } from "@core/context-utils";
import { App, MarkdownView } from "obsidian";

const MAX_WHOLE_VAULT_NOTES = 5;
const MAX_NOTE_CHARS = 3000;

export class ContextResolver {
  constructor(private readonly app: App) {}

  async resolve(scope: ContextScope): Promise<ResolvedContextSummary> {
    switch (scope) {
      case "current-note":
        return this.resolveCurrentNote();
      case "selection":
        return this.resolveSelection();
      case "whole-vault":
        return this.resolveWholeVault();
    }
  }

  private async resolveCurrentNote(): Promise<ResolvedContextSummary> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;

    if (!file) {
      return {
        scope: "current-note",
        title: "No active note",
        description: "Open a Markdown note to use current-note context.",
        notePaths: [],
        contextNotePaths: [],
        promptContext: "No active note is available."
      };
    }

    const content = await this.app.vault.cachedRead(file);

    return {
      scope: "current-note",
      title: file.basename,
      description: `Using the active note at ${file.path}.`,
      notePaths: [file.path],
      contextNotePaths: [file.path],
      promptContext: createPromptContext([{ path: file.path, content }])
    };
  }

  private async resolveSelection(): Promise<ResolvedContextSummary> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    const editor = view?.editor;
    const selection = editor?.getSelection()?.trim() ?? "";

    if (!file || !editor) {
      return {
        scope: "selection",
        title: "No editable note",
        description: "Open a Markdown note to use selection context.",
        notePaths: [],
        contextNotePaths: [],
        promptContext: "No editable Markdown note is available."
      };
    }

    if (!selection) {
      const content = await this.app.vault.cachedRead(file);
      return {
        scope: "selection",
        title: file.basename,
        description: `No text is selected in ${file.path}.`,
        notePaths: [file.path],
        contextNotePaths: [file.path],
        promptContext: createPromptContext([{ path: file.path, content }])
      };
    }

    return {
      scope: "selection",
      title: `${file.basename} selection`,
      description: `Using the current editor selection in ${file.path}.`,
      notePaths: [file.path],
      contextNotePaths: [file.path],
      selectionPreview: truncateSelection(selection),
      promptContext: [`Selection from ${file.path}:`, selection].join("\n\n")
    };
  }

  private async resolveWholeVault(): Promise<ResolvedContextSummary> {
    const files = this.app.vault.getMarkdownFiles();
    const selectedFiles = files.slice(0, MAX_WHOLE_VAULT_NOTES);
    const noteEntries = await Promise.all(
      selectedFiles.map(async (file) => ({
        path: file.path,
        content: await this.app.vault.cachedRead(file)
      }))
    );
    const notePaths = selectedFiles.map((file) => file.path);

    return {
      scope: "whole-vault",
      title: "Whole vault",
      description: `Using the vault-wide note set. ${files.length} Markdown notes are currently available.`,
      notePaths,
      contextNotePaths: notePaths,
      promptContext: createPromptContext(noteEntries)
    };
  }
}

function createPromptContext(
  entries: Array<{ path: string; content: string }>
): string {
  if (entries.length === 0) {
    return "No note content is available for the selected context.";
  }

  return entries
    .map(({ path, content }) =>
      [`Note: ${path}`, content.slice(0, MAX_NOTE_CHARS)].join("\n\n")
    )
    .join("\n\n---\n\n");
}
