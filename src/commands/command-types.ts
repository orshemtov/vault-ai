import type { ProviderId } from "@app/settings";

export interface CommandDefinition {
  id: string;
  description: string;
  template: string;
  agent?: string;
  provider?: ProviderId;
  model?: string;
  source: "vault";
  path?: string;
}

export interface ParsedCommandInvocation {
  commandId: string;
  argumentsText: string;
}
