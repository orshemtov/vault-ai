import type { AssistantCitation } from "@core/assistant-response";
import { formatCitationLabel, getVisibleCitations } from "./citation-display";

describe("citation display", () => {
  it("keeps the highest priority citation per path and limits visible sources", () => {
    const citations: AssistantCitation[] = [
      { path: "Notes/A.md", reason: "context" },
      { path: "Notes/A.md", reason: "explicit" },
      { path: "Notes/B.md", reason: "retrieved" },
      { path: "Notes/C.md", reason: "context" },
      { path: "Notes/D.md", reason: "context" },
      { path: "Notes/E.md", reason: "context" }
    ];

    expect(getVisibleCitations(citations)).toEqual([
      { path: "Notes/A.md", reason: "explicit" },
      { path: "Notes/B.md", reason: "retrieved" },
      { path: "Notes/C.md", reason: "context" },
      { path: "Notes/D.md", reason: "context" }
    ]);
  });

  it("formats citation labels into title and detail", () => {
    expect(formatCitationLabel("Folder/Note Name.md")).toEqual({
      title: "Note Name",
      detail: "Folder"
    });
  });
});
