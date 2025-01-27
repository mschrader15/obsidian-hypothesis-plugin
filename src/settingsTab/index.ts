import templateInstructions from './templateInstructions.html';
import datetimeInstructions from './datetimeInstructions.html';
import type HypothesisPlugin from '~/main';
import pickBy from 'lodash.pickby';
import { App, PluginSettingTab, Setting } from 'obsidian';
import { get } from 'svelte/store';
import { Renderer } from '~/renderer';
import { settingsStore } from '~/store';
import { TokenManager } from '~/store/tokenManager';
import ApiTokenModal from '~/modals/apiTokenModal';
import ResyncDelFileModal from '~/modals/resyncDelFileModal';

const { moment } = window;

export class SettingsTab extends PluginSettingTab {
  public app: App;
  private renderer: Renderer;
  private tokenManager: TokenManager;

  constructor(app: App, plugin: HypothesisPlugin) {
    super(app, plugin);
    this.app = app;
    this.renderer = new Renderer();
    this.tokenManager = new TokenManager();
  }

  public async display(): Promise<void> {
    const { containerEl } = this;

    containerEl.empty();

    if (get(settingsStore).isConnected) {
      this.disconnect();
    } else {
      this.connect();
    }

    this.highlightsFolder();
    this.syncOnBoot();
    this.dateFormat();
    this.template();
    this.resetSyncHistory();
  }

  private disconnect(): void {
    const syncMessage = get(settingsStore).lastSyncDate
      ? `Last sync ${moment(get(settingsStore).lastSyncDate).fromNow()}`
      : 'Sync has never run';

    const descFragment = document.createRange().createContextualFragment(`
      ${get(settingsStore).history.totalArticles} article(s) & ${get(settingsStore).history.totalHighlights} highlight(s) synced<br/>
      ${syncMessage}
    `);

    new Setting(this.containerEl)
      .setName(`Connected to Hypothes.is as ${(get(settingsStore).user).match(/([^:]+)@/)[1]}`)
      .setDesc(descFragment)
      .addButton((button) => {
        return button
          .setButtonText('Disconnect')
          .setCta()
          .onClick(async () => {
            button
              .removeCta()
              .setButtonText('Removing API token...')
              .setDisabled(true);

            await settingsStore.actions.disconnect();

            this.display(); // rerender
          });
      });
  }

  private connect(): void {
      new Setting(this.containerEl)
      .setName('Connect to Hypothes.is')
      .addButton((button) => {
        return button
          .setButtonText('Connect')
          .setCta()
          .onClick(async () => {
            button
              .removeCta()
              .setButtonText('Removing API token...')
              .setDisabled(true);

            const tokenModal = new ApiTokenModal(this.app, this.tokenManager);
            await tokenModal.waitForClose;

            this.display(); // rerender
          });
      });
  }

  private highlightsFolder(): void {
    new Setting(this.containerEl)
      .setName('Highlights folder location')
      .setDesc('Vault folder to use for writing hypothesis highlights')
      .addDropdown((dropdown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const files = (this.app.vault.adapter as any).files;
        const folders = pickBy(files, (val) => {
          return val.type === 'folder';
        });

        Object.keys(folders).forEach((val) => {
          dropdown.addOption(val, val);
        });
        return dropdown
          .setValue(get(settingsStore).highlightsFolder)
          .onChange(async (value) => {
            await settingsStore.actions.setHighlightsFolder(value);
          });
      });
  }

  private template(): void {

    const descFragment = document
      .createRange()
      .createContextualFragment(templateInstructions);

    new Setting(this.containerEl)
      .setName('Highlights template')
      .setDesc(descFragment)
      .addTextArea((text) => {
        text.inputEl.style.width = '100%';
        text.inputEl.style.height = '450px';
        text.inputEl.style.fontSize = '0.8em';
        text
          .setValue(get(settingsStore).template)
          .onChange(async (value) => {
            const isValid = this.renderer.validate(value);

            if (isValid) {
              await settingsStore.actions.setTemplate(value);
            }

            text.inputEl.style.border = isValid ? '' : '1px solid red';
          });
        return text;
      });
  }

  private syncOnBoot(): void {
    new Setting(this.containerEl)
      .setName('Sync on Startup')
      .setDesc(
        'Automatically sync new highlights when Obsidian starts'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(get(settingsStore).syncOnBoot)
          .onChange(async (value) => {
            await settingsStore.actions.setSyncOnBoot(value);
          })
      );
  }

  private resetSyncHistory(): void {
    new Setting(this.containerEl)
      .setName('Reset sync')
      .setDesc('Wipe sync history to allow for resync')
      .addButton((button) => {
        return button
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            await settingsStore.actions.resetSyncHistory();
            this.display(); // rerender
          });
      });
  }

  private dateFormat(): void {
    const descFragment = document
      .createRange()
      .createContextualFragment(datetimeInstructions);

    new Setting(this.containerEl)
      .setName('Date & time format')
      .setDesc(descFragment)
      .addText((text) => {
        text
          .setPlaceholder('YYYY-MM-DD HH:mm:ss')
          .setValue(get(settingsStore).dateTimeFormat)
          .onChange(async (value) => {
            await settingsStore.actions.setDateTimeFormat(value);
          });
      });
  }

  private async resyncDeletedFile(): Promise<void> {
      new Setting(this.containerEl)
      .setName('Sync deleted file(s)')
      .setDesc('Manually sync deleted file(s)')
      .addButton((button) => {
        return button
          .setButtonText('Show deleted file(s)')
          .setCta()
          .onClick(async () => {
            button
              .removeCta()
              .setButtonText('Resync deleted file..')
              .setDisabled(true);

            const resyncDelFileModal = new ResyncDelFileModal(this.app);
            await resyncDelFileModal.waitForClose;

            this.display(); // rerender
          });
      });
   }

}
