import {
  getFirstGenerationModelForProvider,
  listGenerationModels
} from "@providers/provider-selection";
import type { VaultAiPlugin } from "@app/plugin";
import type { ProviderId } from "@app/settings";
import { PluginSettingTab, Setting } from "obsidian";

const MODEL_KEY_SEPARATOR = "::";

export class VaultAiPluginSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: VaultAiPlugin) {
    super(plugin.app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Vault AI" });

    const defaultsSection = createSection(containerEl, "General");
    const modelsSection = createSection(containerEl, "Models");
    const vaultSection = createSection(containerEl, "Vault");
    const behaviorSection = createSection(containerEl, "Behavior");
    const advancedSection = createSection(containerEl, "Advanced");

    const currentProviderId = this.plugin.settings.defaultProvider;

    const catalogs = this.plugin.getProviderCatalogSnapshots([
      "openrouter",
      "ollama",
      "openai",
      "anthropic"
    ]);
    const modelOptions = listGenerationModels(catalogs).map((model) => ({
      providerId: model.providerId,
      modelId: model.modelId,
      key: `${model.providerId}${MODEL_KEY_SEPARATOR}${model.modelId}`,
      label: `${model.providerId}/${model.displayName}`
    }));
    const selectedProviderModelOptions = modelOptions.filter(
      (option) => option.providerId === currentProviderId
    );
    const resolvedProviderModel =
      selectedProviderModelOptions.find(
        (option) => option.modelId === this.plugin.settings.defaultChatModel
      ) ??
      selectedProviderModelOptions[0] ??
      null;
    const currentModelKey = `${this.plugin.settings.defaultProvider}${MODEL_KEY_SEPARATOR}${this.plugin.settings.defaultChatModel}`;

    new Setting(defaultsSection)
      .setName("Default agent")
      .addDropdown((dropdown) => {
        const availableAgents = ["ask", "edit"];
        for (const agentId of availableAgents) {
          dropdown.addOption(agentId, agentId);
        }

        dropdown
          .setValue(this.plugin.settings.defaultAgent)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              defaultAgent: value.trim() || "ask"
            });
          });
      });

    new Setting(modelsSection).setName("Provider").addDropdown((dropdown) => {
      dropdown
        .addOption("openrouter", "openrouter")
        .addOption("ollama", "ollama")
        .addOption("openai", "openai")
        .addOption("anthropic", "anthropic")
        .setValue(currentProviderId)
        .onChange(async (value) => {
          const providerId = value as ProviderId;
          const firstProviderModel = getFirstGenerationModelForProvider(
            catalogs,
            providerId
          );
          await this.plugin.updateSettings({
            defaultProvider: providerId,
            defaultChatModel:
              firstProviderModel?.modelId ??
              this.plugin.settings.defaultChatModel
          });
          this.display();
        });
    });

    new Setting(modelsSection).setName("Model").addDropdown((dropdown) => {
      if (selectedProviderModelOptions.length > 0) {
        for (const option of selectedProviderModelOptions) {
          dropdown.addOption(option.key, option.label);
        }
      } else {
        dropdown.addOption(currentModelKey, currentModelKey);
      }

      dropdown
        .setValue(resolvedProviderModel?.key ?? currentModelKey)
        .onChange(async (value) => {
          const [, modelId] = value.split(MODEL_KEY_SEPARATOR) as [
            ProviderId,
            string
          ];

          await this.plugin.updateSettings({
            defaultProvider: currentProviderId,
            defaultChatModel: modelId
          });
        });
    });

    renderProviderSettings(modelsSection, this.plugin, currentProviderId);

    new Setting(vaultSection).setName("Agents root").addText((text) => {
      text.setValue(this.plugin.settings.agentsRoot).onChange(async (value) => {
        await this.plugin.updateSettings({
          agentsRoot: value.trim() || "Agents"
        });
      });
    });

    new Setting(vaultSection).setName("Skills root").addText((text) => {
      text.setValue(this.plugin.settings.skillsRoot).onChange(async (value) => {
        await this.plugin.updateSettings({
          skillsRoot: value.trim() || "Skills"
        });
      });
    });

    new Setting(vaultSection).setName("Commands root").addText((text) => {
      text
        .setValue(this.plugin.settings.commandsRoot)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            commandsRoot: value.trim() || "Commands"
          });
        });
    });

    new Setting(vaultSection).setName("Conversations root").addText((text) => {
      text
        .setValue(this.plugin.settings.conversationsRoot)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            conversationsRoot: value.trim() || "AI/Conversations"
          });
        });
    });

    new Setting(vaultSection).setName("Memory root").addText((text) => {
      text.setValue(this.plugin.settings.memoryRoot).onChange(async (value) => {
        await this.plugin.updateSettings({
          memoryRoot: value.trim() || "AI/Memory"
        });
      });
    });

    new Setting(behaviorSection)
      .setName("Enable indexing on startup")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableIndexingOnStartup)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              enableIndexingOnStartup: value
            });
          });
      });

    new Setting(advancedSection)
      .setName("Enable debug logging")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableDebugLogging)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ enableDebugLogging: value });
          });
      });

    new Setting(advancedSection)
      .setName("Refresh provider catalogs")
      .addButton((button) => {
        button.setButtonText("Refresh now").onClick(async () => {
          button.setDisabled(true);
          await this.plugin.refreshProviderCatalogs();
          button.setDisabled(false);
        });
      });
  }
}

function renderProviderSettings(
  providerSection: HTMLElement,
  plugin: VaultAiPlugin,
  providerId: ProviderId
): void {
  if (providerId === "openrouter") {
    new Setting(providerSection).setName("Base URL").addText((text) => {
      text
        .setValue(plugin.settings.openRouterBaseUrl)
        .onChange(async (value) => {
          await plugin.updateSettings({
            openRouterBaseUrl: value.trim() || plugin.settings.openRouterBaseUrl
          });
        });
    });

    new Setting(providerSection).setName("API key").addText((text) => {
      text.inputEl.type = "password";
      text
        .setPlaceholder("sk-or-v1-...")
        .setValue(plugin.settings.openRouterApiKey)
        .onChange(async (value) => {
          await plugin.updateSettings({
            openRouterApiKey: value.trim()
          });
        });
    });
    return;
  }

  if (providerId === "ollama") {
    new Setting(providerSection).setName("Base URL").addText((text) => {
      text.setValue(plugin.settings.ollamaBaseUrl).onChange(async (value) => {
        await plugin.updateSettings({
          ollamaBaseUrl: value.trim() || plugin.settings.ollamaBaseUrl
        });
      });
    });
    return;
  }

  if (providerId === "openai") {
    new Setting(providerSection).setName("Base URL").addText((text) => {
      text.setValue(plugin.settings.openAiBaseUrl).onChange(async (value) => {
        await plugin.updateSettings({
          openAiBaseUrl: value.trim() || plugin.settings.openAiBaseUrl
        });
      });
    });

    new Setting(providerSection).setName("API key").addText((text) => {
      text.inputEl.type = "password";
      text
        .setPlaceholder("sk-...")
        .setValue(plugin.settings.openAiApiKey)
        .onChange(async (value) => {
          await plugin.updateSettings({
            openAiApiKey: value.trim()
          });
        });
    });
    return;
  }

  new Setting(providerSection).setName("Base URL").addText((text) => {
    text.setValue(plugin.settings.anthropicBaseUrl).onChange(async (value) => {
      await plugin.updateSettings({
        anthropicBaseUrl: value.trim() || plugin.settings.anthropicBaseUrl
      });
    });
  });

  new Setting(providerSection).setName("API key").addText((text) => {
    text.inputEl.type = "password";
    text
      .setPlaceholder("sk-ant-...")
      .setValue(plugin.settings.anthropicApiKey)
      .onChange(async (value) => {
        await plugin.updateSettings({
          anthropicApiKey: value.trim()
        });
      });
  });
}

function createSection(
  containerEl: HTMLElement,
  title: string
): HTMLDivElement {
  const section = containerEl.createDiv({
    cls: "vault-ai__settings-section"
  });
  section.createEl("h3", { text: title });
  return section;
}
