import type { OpenVaultAiPluginSettings, ProviderId } from "@app/settings";
import {
  createEmptyProviderCatalogSnapshot,
  type ProviderCapabilityMetadata,
  type ProviderCatalogSnapshot
} from "./provider-runtime";
import { ProviderRegistry } from "./provider-registry";

export class ProviderCatalogService {
  private readonly snapshots = new Map<ProviderId, ProviderCatalogSnapshot>();

  constructor(private readonly registry: ProviderRegistry) {}

  getSnapshot(providerId: ProviderId): ProviderCatalogSnapshot {
    return (
      this.snapshots.get(providerId) ??
      createEmptyProviderCatalogSnapshot(providerId)
    );
  }

  getAllSnapshots(providerIds: ProviderId[]): ProviderCatalogSnapshot[] {
    return providerIds.map((providerId) => this.getSnapshot(providerId));
  }

  async refreshProvider(
    providerId: ProviderId,
    settings: OpenVaultAiPluginSettings
  ): Promise<ProviderCatalogSnapshot> {
    const adapter = this.registry.get(providerId);
    if (!adapter) {
      const snapshot = {
        ...createEmptyProviderCatalogSnapshot(providerId),
        status: "error" as const,
        error: `No adapter registered for provider '${providerId}'.`
      };
      this.snapshots.set(providerId, snapshot);
      return snapshot;
    }

    this.snapshots.set(providerId, {
      ...this.getSnapshot(providerId),
      status: "loading",
      error: null
    });

    try {
      const models = await adapter.listModels(settings);
      const snapshot: ProviderCatalogSnapshot = {
        providerId,
        status: "ready",
        models: sortModels(models),
        error: null,
        fetchedAt: Date.now()
      };
      this.snapshots.set(providerId, snapshot);
      return snapshot;
    } catch (error) {
      const snapshot: ProviderCatalogSnapshot = {
        providerId,
        status: "error",
        models: [],
        error:
          error instanceof Error ? error.message : "Unknown provider error",
        fetchedAt: Date.now()
      };
      this.snapshots.set(providerId, snapshot);
      return snapshot;
    }
  }

  async refreshAll(
    settings: OpenVaultAiPluginSettings
  ): Promise<ProviderCatalogSnapshot[]> {
    const providers = this.registry.list().map((adapter) => adapter.id);
    return Promise.all(
      providers.map((providerId) => this.refreshProvider(providerId, settings))
    );
  }
}

function sortModels(
  models: ProviderCapabilityMetadata[]
): ProviderCapabilityMetadata[] {
  return [...models].sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
}
