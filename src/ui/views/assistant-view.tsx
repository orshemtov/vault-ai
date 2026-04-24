import type { OpenVaultAiPlugin } from "@app/plugin";
import { AssistantShell } from "@ui/components/assistant-shell";
import {
  VIEW_ICON_ASSISTANT,
  VIEW_TITLE_ASSISTANT,
  VIEW_TYPE_ASSISTANT
} from "@core/constants";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";

export class AssistantView extends ItemView {
  private root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: OpenVaultAiPlugin
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return VIEW_TYPE_ASSISTANT;
  }

  override getDisplayText(): string {
    return VIEW_TITLE_ASSISTANT;
  }

  override getIcon(): string {
    return VIEW_ICON_ASSISTANT;
  }

  override async onOpen(): Promise<void> {
    this.root = createRoot(this.contentEl);
    this.render();
    await Promise.resolve();
  }

  override async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
    await Promise.resolve();
  }

  render(): void {
    this.root?.render(
      <AssistantShell plugin={this.plugin} settings={this.plugin.settings} />
    );
  }
}
