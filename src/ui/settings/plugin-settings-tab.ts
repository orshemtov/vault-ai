import {
  DEFAULT_AGENT,
  DEFAULT_PROVIDER_URLS,
  DEFAULT_VAULT_ROOTS,
  SUPPORTED_PROVIDERS
} from "@app/defaults";
import { getFirstGenerationModelForProvider } from "@providers/provider-selection";
import type { OpenVaultAiPlugin } from "@app/plugin";
import type { ProviderId } from "@app/settings";
import { PluginSettingTab, Setting } from "obsidian";

export class OpenVaultAiPluginSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: OpenVaultAiPlugin) {
    super(plugin.app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("OpenVault AI").setHeading();

    const generalSection = createSection(containerEl, "General");
    const configurationSection = createSection(containerEl, "Configuration");
    const vaultSection = createSection(containerEl, "Vault");
    const advancedSection = createSection(containerEl, "Advanced");

    const currentProviderId = this.plugin.settings.defaultProvider;

    const catalogs =
      this.plugin.getProviderCatalogSnapshots(SUPPORTED_PROVIDERS);
    new Setting(generalSection).setName("Provider").addDropdown((dropdown) => {
      for (const providerId of SUPPORTED_PROVIDERS) {
        dropdown.addOption(providerId, providerId);
      }

      dropdown.setValue(currentProviderId).onChange(async (value) => {
        const providerId = value as ProviderId;
        const firstProviderModel = getFirstGenerationModelForProvider(
          catalogs,
          providerId
        );
        await this.plugin.updateSettings({
          defaultProvider: providerId,
          defaultChatModel:
            firstProviderModel?.modelId ?? this.plugin.settings.defaultChatModel
        });
        this.display();
      });
    });

    renderProviderSettings(generalSection, this.plugin, currentProviderId);

    new Setting(configurationSection)
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
              defaultAgent: value.trim() || DEFAULT_AGENT
            });
          });
      });

    new Setting(vaultSection).setName("Agents root").addText((text) => {
      text.setValue(this.plugin.settings.agentsRoot).onChange(async (value) => {
        await this.plugin.updateSettings({
          agentsRoot: value.trim() || DEFAULT_VAULT_ROOTS.agentsRoot
        });
      });
    });

    new Setting(vaultSection).setName("Skills root").addText((text) => {
      text.setValue(this.plugin.settings.skillsRoot).onChange(async (value) => {
        await this.plugin.updateSettings({
          skillsRoot: value.trim() || DEFAULT_VAULT_ROOTS.skillsRoot
        });
      });
    });

    new Setting(vaultSection).setName("Commands root").addText((text) => {
      text
        .setValue(this.plugin.settings.commandsRoot)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            commandsRoot: value.trim() || DEFAULT_VAULT_ROOTS.commandsRoot
          });
        });
    });

    new Setting(vaultSection).setName("Conversations root").addText((text) => {
      text
        .setValue(this.plugin.settings.conversationsRoot)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            conversationsRoot:
              value.trim() || DEFAULT_VAULT_ROOTS.conversationsRoot
          });
        });
    });

    new Setting(vaultSection).setName("Memory root").addText((text) => {
      text.setValue(this.plugin.settings.memoryRoot).onChange(async (value) => {
        await this.plugin.updateSettings({
          memoryRoot: value.trim() || DEFAULT_VAULT_ROOTS.memoryRoot
        });
      });
    });

    new Setting(advancedSection)
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
  plugin: OpenVaultAiPlugin,
  providerId: ProviderId
): void {
  if (providerId === "openrouter") {
    new Setting(providerSection).setName("Base URL").addText((text) => {
      text
        .setValue(plugin.settings.openRouterBaseUrl)
        .onChange(async (value) => {
          await plugin.updateSettings({
            openRouterBaseUrl:
              value.trim() || DEFAULT_PROVIDER_URLS.openRouterBaseUrl
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
          ollamaBaseUrl: value.trim() || DEFAULT_PROVIDER_URLS.ollamaBaseUrl
        });
      });
    });
    return;
  }

  if (providerId === "openai") {
    new Setting(providerSection).setName("Base URL").addText((text) => {
      text.setValue(plugin.settings.openAiBaseUrl).onChange(async (value) => {
        await plugin.updateSettings({
          openAiBaseUrl: value.trim() || DEFAULT_PROVIDER_URLS.openAiBaseUrl
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
        anthropicBaseUrl: value.trim() || DEFAULT_PROVIDER_URLS.anthropicBaseUrl
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
    cls: "openvault-ai__settings-section"
  });
  new Setting(section).setName(title).setHeading();
  return section;
}
