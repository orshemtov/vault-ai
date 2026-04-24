import {
  applyCommandTemplate,
  parseCommandInvocation,
  parseCommandMarkdown
} from "./command-parser";

describe("command parser", () => {
  it("parses command markdown", () => {
    const command = parseCommandMarkdown(
      `---
description: Summarize a note
agent: ask
provider: openai
model: openai/gpt-5.4
---
Summarize $ARGUMENTS
`,
      "summarize"
    );

    expect(command.id).toBe("summarize");
    expect(command.agent).toBe("ask");
    expect(command.provider).toBe("openai");
    expect(command.template).toContain("$ARGUMENTS");
  });

  it("parses slash command invocations", () => {
    expect(parseCommandInvocation("/summarize Notes/Project.md")).toEqual({
      commandId: "summarize",
      argumentsText: "Notes/Project.md"
    });
  });

  it("expands command arguments", () => {
    expect(
      applyCommandTemplate(
        {
          id: "summarize",
          description: "Summarize a note",
          template: "Summarize $ARGUMENTS then focus on $1",
          source: "vault"
        },
        "Notes/Project.md"
      )
    ).toBe("Summarize Notes/Project.md then focus on Notes/Project.md");
  });
});
