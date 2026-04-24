import { providerIdSchema } from "@app/settings";
import matter from "gray-matter";
import { z } from "zod";
import type {
  CommandDefinition,
  ParsedCommandInvocation
} from "./command-types";

const commandFrontmatterSchema = z.object({
  description: z.string().min(1),
  agent: z.string().min(1).optional(),
  provider: providerIdSchema.optional(),
  model: z.string().min(1).optional()
});

export function parseCommandMarkdown(
  fileContent: string,
  commandId: string,
  path?: string
): CommandDefinition {
  const parsed = matter(fileContent);
  const frontmatter = commandFrontmatterSchema.parse(parsed.data);

  return {
    id: commandId,
    description: frontmatter.description,
    template: parsed.content.trim(),
    agent: frontmatter.agent,
    provider: frontmatter.provider,
    model: frontmatter.model,
    source: "vault",
    path
  };
}

export function parseCommandInvocation(
  prompt: string
): ParsedCommandInvocation | null {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt.startsWith("/")) {
    return null;
  }

  const firstSpace = trimmedPrompt.indexOf(" ");
  const commandId = trimmedPrompt.slice(
    1,
    firstSpace === -1 ? undefined : firstSpace
  );
  if (!commandId) {
    return null;
  }

  return {
    commandId,
    argumentsText: firstSpace === -1 ? "" : trimmedPrompt.slice(firstSpace + 1)
  };
}

export function applyCommandTemplate(
  command: CommandDefinition,
  argumentsText: string
): string {
  return command.template
    .replace(/\$ARGUMENTS/g, argumentsText)
    .replace(/\$1/g, argumentsText.split(/\s+/).filter(Boolean)[0] ?? "")
    .replace(/\$2/g, argumentsText.split(/\s+/).filter(Boolean)[1] ?? "")
    .replace(/\$3/g, argumentsText.split(/\s+/).filter(Boolean)[2] ?? "");
}
