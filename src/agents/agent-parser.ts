import matter from "gray-matter";
import { z } from "zod";
import type { AgentDefinition } from "./agent-types";

const accessModeSchema = z.enum([
  "allow-all",
  "deny-all",
  "include",
  "exclude"
]);
const providerIdSchema = z.enum([
  "openrouter",
  "ollama",
  "openai",
  "anthropic"
]);
const agentModeSchema = z.enum(["primary", "subagent"]);

const agentFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  mode: agentModeSchema.default("primary"),
  provider: providerIdSchema.default("openrouter"),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.2),
  notes: z
    .object({
      read: z.boolean().default(true),
      search: z.boolean().default(true),
      create: z.boolean().default(false),
      edit: z.boolean().default(false),
      move: z.boolean().default(false),
      delete: z.boolean().default(false)
    })
    .default({
      read: true,
      search: true,
      create: false,
      edit: false,
      move: false,
      delete: false
    }),
  tools: z
    .object({
      mode: accessModeSchema.default("allow-all"),
      items: z.array(z.string()).default([])
    })
    .default({ mode: "allow-all", items: [] }),
  skills: z
    .object({
      mode: accessModeSchema.default("allow-all"),
      items: z.array(z.string()).default([])
    })
    .default({ mode: "allow-all", items: [] })
});

export function parseAgentMarkdown(
  fileContent: string,
  agentId: string,
  path?: string
): AgentDefinition {
  const parsed = matter(fileContent);
  const frontmatter = agentFrontmatterSchema.parse(parsed.data);

  return {
    id: agentId,
    name: frontmatter.name,
    description: frontmatter.description,
    mode: frontmatter.mode,
    provider: frontmatter.provider,
    model: frontmatter.model,
    temperature: frontmatter.temperature,
    notes: frontmatter.notes,
    tools: frontmatter.tools,
    skills: frontmatter.skills,
    prompt: parsed.content.trim(),
    source: "vault",
    path
  };
}
