export interface PersistedMemoryEntry {
  id: string;
  path: string;
  type: "preference" | "fact" | "lesson";
  summary: string;
  details: string;
  createdAt: string;
  updatedAt: string;
  sourceConversationPath?: string;
  tags: string[];
}
