export const CONTEXT_SCOPES = [
  "current-note",
  "selection",
  "whole-vault"
] as const;

export type ContextScope = (typeof CONTEXT_SCOPES)[number];

export interface RetrievedContextNote {
  path: string;
  score: number;
  snippet: string;
}

export interface ResolvedContextSummary {
  scope: ContextScope;
  title: string;
  description: string;
  notePaths: string[];
  contextNotePaths?: string[];
  explicitNotePaths?: string[];
  retrievalNotePaths?: string[];
  retrievalNotes?: RetrievedContextNote[];
  retrievalQuery?: string;
  selectionPreview?: string;
  promptContext: string;
}
