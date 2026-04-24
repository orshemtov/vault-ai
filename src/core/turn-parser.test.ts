import {
  parseTurnInput,
  getCommandSuggestions,
  getMentionSuggestions,
  applySuggestion
} from "./turn-parser";

describe("turn parser", () => {
  const agents = [
    {
      id: "ask",
      name: "Ask",
      description: "Read assistant"
    },
    {
      id: "edit",
      name: "Edit",
      description: "Edit assistant"
    }
  ];

  it("resolves slash commands before sending", async () => {
    const result = await parseTurnInput({
      prompt: "/summarize Notes/Project.md",
      agents: agents as never,
      expandCommand: () =>
        Promise.resolve({
          command: {
            id: "summarize",
            description: "Summarize a note",
            template: "Summarize $ARGUMENTS",
            agent: "ask",
            source: "vault"
          },
          prompt: "Summarize Notes/Project.md"
        })
    });

    expect(result.prompt).toBe("Summarize Notes/Project.md");
    expect(result.agentId).toBe("ask");
    expect(result.noteMentions).toEqual([]);
  });

  it("extracts a leading agent mention", async () => {
    const result = await parseTurnInput({
      prompt: "@edit rewrite this note",
      agents: agents as never,
      expandCommand: () => Promise.resolve(null)
    });

    expect(result.agentId).toBe("edit");
    expect(result.prompt).toBe("rewrite this note");
    expect(result.noteMentions).toEqual([]);
  });

  it("captures explicit note mentions", async () => {
    const result = await parseTurnInput({
      prompt: "compare @Project.md with the current note",
      agents: agents as never,
      expandCommand: () => Promise.resolve(null)
    });

    expect(result.noteMentions).toEqual(["Project.md"]);
  });

  it("captures quoted note mentions with spaces", async () => {
    const result = await parseTurnInput({
      prompt: 'summarize @"Fleeting/Home gym.md" please',
      agents: agents as never,
      expandCommand: () => Promise.resolve(null)
    });

    expect(result.noteMentions).toEqual(["Fleeting/Home gym.md"]);
  });

  it("captures @all as a whole-vault context request", async () => {
    const result = await parseTurnInput({
      prompt: "compare @all with @Project.md",
      agents: agents as never,
      expandCommand: () => Promise.resolve(null)
    });

    expect(result.includeAllNotes).toBe(true);
    expect(result.noteMentions).toEqual(["Project.md"]);
  });

  it("suggests matching commands and mentions", () => {
    expect(
      getCommandSuggestions("/sum", [
        {
          id: "summarize",
          description: "Summarize a note",
          template: "Summarize",
          source: "vault"
        }
      ])
    ).toHaveLength(1);
    expect(
      getMentionSuggestions({
        prompt: "@pr",
        agents: agents as never,
        notePaths: ["Projects/Project.md", "Projects/Plan.md"]
      }).map((item) => item.type)
    ).toEqual(expect.arrayContaining(["note", "folder"]));
  });

  it("suggests @all as a context target", () => {
    expect(
      getMentionSuggestions({
        prompt: "@a",
        agents: agents as never,
        notePaths: ["Project.md"]
      }).map((item) => item.type)
    ).toContain("context");
  });

  it("supports # note suggestions with the same mention flow", () => {
    const suggestions = getMentionSuggestions({
      prompt: "#pr",
      agents: agents as never,
      notePaths: ["Projects/Project.md", "Projects/Plan.md"]
    });

    expect(suggestions[0]?.label.startsWith("#")).toBe(true);
    expect(suggestions.map((item) => item.type)).toEqual(
      expect.arrayContaining(["note", "folder"])
    );
  });

  it("replaces the active mention token when accepting a suggestion", () => {
    expect(
      applySuggestion("please help me @gym", "@Fleeting/Home Gym.md")
    ).toBe("please help me @Fleeting/Home Gym.md");
  });
});
