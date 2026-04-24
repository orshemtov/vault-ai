import type { AssistantCitation } from "@core/assistant-response";

const MAX_VISIBLE_SOURCES = 4;

export function getVisibleCitations(
  citations: AssistantCitation[] = []
): AssistantCitation[] {
  const priorityByReason = {
    explicit: 0,
    retrieved: 1,
    context: 2
  } as const;

  return [...citations]
    .sort(
      (left, right) =>
        priorityByReason[left.reason] - priorityByReason[right.reason] ||
        left.path.localeCompare(right.path)
    )
    .filter(
      (citation, index, items) =>
        items.findIndex((candidate) => candidate.path === citation.path) ===
        index
    )
    .slice(0, MAX_VISIBLE_SOURCES);
}

export function formatCitationLabel(path: string): {
  title: string;
  detail: string | null;
} {
  const parts = path.split("/");
  const fileName = parts.pop() ?? path;
  const title = fileName.replace(/\.md$/i, "");
  const detail = parts.length > 0 ? parts.join("/") : null;

  return { title, detail };
}
