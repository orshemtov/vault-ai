import type { CommandDefinition } from "@commands/command-types";
import type { ProviderId } from "@app/settings";
import type { ProviderCatalogSnapshot } from "./provider-runtime";
import {
  findExactGenerationModel,
  getFirstGenerationModelForProvider
} from "./provider-selection";

export function resolveRuntimeModelSelection(
  catalogs: ProviderCatalogSnapshot[],
  providerId: ProviderId,
  modelId: string,
  command?: CommandDefinition
): { providerId: ProviderId; modelId: string } {
  if (!command?.model && !command?.provider) {
    return { providerId, modelId };
  }

  if (command.provider && !command.model) {
    return (
      getFirstGenerationModelForProvider(catalogs, command.provider) ?? {
        providerId,
        modelId
      }
    );
  }

  const commandProviderId = command.provider ?? providerId;
  const commandModelId = command.model ?? modelId;
  const exactSelection = findExactGenerationModel(catalogs, {
    providerId: commandProviderId,
    modelId: commandModelId
  });
  if (exactSelection) {
    return exactSelection;
  }

  return { providerId, modelId };
}
