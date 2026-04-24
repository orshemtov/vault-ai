import { vi } from "vitest";
import { TFile } from "obsidian";
import { AgentRegistry } from "@agents/agent-registry";
import { CommandsRegistry } from "@commands/commands-registry";
import { SkillsRegistry } from "@skills/skills-registry";

vi.mock("obsidian", () => ({
  App: class {},
  TFile: class {},
  normalizePath: (value: string) =>
    value.replace(/\\/g, "/").replace(/\/+/g, "/")
}));

describe("dynamic vault discovery", () => {
  it("discovers a newly added vault agent immediately", async () => {
    const app = createApp();
    const registry = new AgentRegistry(app as never);

    app.addFile(
      "Agents/researcher/AGENT.md",
      `---
name: Researcher
description: Research helper
mode: subagent
provider: openai
model: gpt-5.4
---
Research deeply.`
    );

    const agent = await registry.getAgentById("researcher", "Agents");
    expect(agent?.name).toBe("Researcher");
    expect(agent?.provider).toBe("openai");
  });

  it("discovers a newly added vault skill immediately", async () => {
    const app = createApp();
    const registry = new SkillsRegistry(app as never, "Skills");

    app.addFile(
      "Skills/bullets/SKILL.md",
      `---
name: Bullet Summaries
description: Prefer concise bullet summaries
---
Use short bullet points.`
    );

    const skill = await registry.getSkillById("bullets", "Skills");
    expect(skill?.name).toBe("Bullet Summaries");
    expect(skill?.prompt).toContain("short bullet points");
  });

  it("discovers and expands a newly added vault command immediately", async () => {
    const app = createApp();
    const registry = new CommandsRegistry(app as never, "Commands");

    app.addFile(
      "Commands/summarize.md",
      `---
description: Summarize a note
agent: ask
provider: openai
model: gpt-5.4
---
Summarize this note:

$ARGUMENTS`
    );

    const expanded = await registry.expandCommand(
      "summarize",
      "Permanent/AWS Redshift.md"
    );

    expect(expanded?.command.provider).toBe("openai");
    expect(expanded?.prompt).toContain("AWS Redshift.md");
  });
});

function createApp() {
  const files = new Map<string, InstanceType<typeof TFile>>();
  const contents = new Map<string, string>();

  return {
    vault: {
      getMarkdownFiles: () => [...files.values()],
      cachedRead: async (file: { path: string }) =>
        contents.get(file.path) ?? ""
    },
    addFile(path: string, content: string) {
      const file = new TFile();
      Object.assign(file, {
        path,
        name: path.split("/").pop() ?? path,
        basename: (path.split("/").pop() ?? path).replace(/\.md$/, ""),
        extension: "md",
        parent: { path: path.split("/").slice(0, -1).join("/") }
      });
      files.set(path, file);
      contents.set(path, content);
    }
  };
}
