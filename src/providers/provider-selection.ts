import type { ProviderId } from "@app/settings";
import type {
  ProviderCapabilityMetadata,
  ProviderCatalogSnapshot
} from "./provider-runtime";

export interface ProviderModelSelection {
  providerId: ProviderId;
  modelId: string;
}

export function listGenerationModels(
  catalogs: ProviderCatalogSnapshot[]
): ProviderCapabilityMetadata[] {
  return catalogs.flatMap((catalog) =>
    catalog.models.filter((model) => model.supportsGeneration)
  );
}

export function findExactGenerationModel(
  catalogs: ProviderCatalogSnapshot[],
  selection: ProviderModelSelection
): ProviderModelSelection | null {
  const exactProviderMatch = listGenerationModels(catalogs).find(
    (model) =>
      model.providerId === selection.providerId &&
      model.modelId === selection.modelId
  );
  if (exactProviderMatch) {
    return {
      providerId: exactProviderMatch.providerId,
      modelId: exactProviderMatch.modelId
    };
  }

  const globalMatches = listGenerationModels(catalogs).filter(
    (model) => model.modelId === selection.modelId
  );
  if (globalMatches.length === 1) {
    return {
      providerId: globalMatches[0].providerId,
      modelId: globalMatches[0].modelId
    };
  }

  return null;
}

export function getFirstGenerationModelForProvider(
  catalogs: ProviderCatalogSnapshot[],
  providerId: ProviderId
): ProviderModelSelection | null {
  const providerModel = listGenerationModels(catalogs).find(
    (model) => model.providerId === providerId
  );
  if (!providerModel) {
    return null;
  }

  return {
    providerId: providerModel.providerId,
    modelId: providerModel.modelId
  };
}

export function getGenerationModelsForProvider(
  catalogs: ProviderCatalogSnapshot[],
  providerId: ProviderId
): ProviderCapabilityMetadata[] {
  return listGenerationModels(catalogs).filter(
    (model) => model.providerId === providerId
  );
}

export function resolveProviderScopedModel(
  catalogs: ProviderCatalogSnapshot[],
  providerId: ProviderId,
  modelId: string
): ProviderModelSelection | null {
  const providerModel = getGenerationModelsForProvider(
    catalogs,
    providerId
  ).find((model) => model.modelId === modelId);
  if (!providerModel) {
    return getFirstGenerationModelForProvider(catalogs, providerId);
  }

  return {
    providerId: providerModel.providerId,
    modelId: providerModel.modelId
  };
}
