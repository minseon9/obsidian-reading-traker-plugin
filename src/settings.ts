import { App, PluginSettingTab, Setting } from "obsidian";
import BookshelfPlugin from "./main";

/**
 * Bookshelf plugin settings interface
 */
export interface BookshelfSettings {
	// Folder settings
	bookFolder: string;
	templateFile: string;

	// API settings
	apiTimeout: number;

	// UI settings
	showCoverImages: boolean;
	coverImageSize: 'S' | 'M' | 'L';
	saveCoverLocally: boolean;

	// Auto update
	autoUpdateTimestamp: boolean;

	// Default values
	defaultStatus: 'unread' | 'reading';
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: BookshelfSettings = {
	bookFolder: 'Bookshelf',
	templateFile: 'template_example.md',
	apiTimeout: 5000,
	showCoverImages: true,
	coverImageSize: 'M',
	saveCoverLocally: false,
	autoUpdateTimestamp: true,
	defaultStatus: 'unread',
};

/**
 * Bookshelf plugin settings tab
 */
export class BookshelfSettingTab extends PluginSettingTab {
	plugin: BookshelfPlugin;

	constructor(app: App, plugin: BookshelfPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Bookshelf Settings' });

		// Folder settings
		containerEl.createEl('h3', { text: 'Folder Settings' });

		new Setting(containerEl)
			.setName('Book notes folder')
			.setDesc('Folder path where book notes will be saved')
			.addText(text => text
				.setPlaceholder('Books')
				.setValue(this.plugin.settings.bookFolder)
				.onChange(async (value) => {
					this.plugin.settings.bookFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Template file path')
			.setDesc('Path to the template file used for creating book notes')
			.addText(text => text
				.setPlaceholder('template_example.md')
				.setValue(this.plugin.settings.templateFile)
				.onChange(async (value) => {
					this.plugin.settings.templateFile = value;
					await this.plugin.saveSettings();
				}));

		// API settings
		containerEl.createEl('h3', { text: 'API Settings' });

		new Setting(containerEl)
			.setName('API timeout (ms)')
			.setDesc('Timeout duration for Open Library API requests (in milliseconds)')
			.addText(text => text
				.setPlaceholder('5000')
				.setValue(this.plugin.settings.apiTimeout.toString())
				.onChange(async (value) => {
					const timeout = parseInt(value, 10);
					if (!isNaN(timeout) && timeout > 0) {
						this.plugin.settings.apiTimeout = timeout;
						await this.plugin.saveSettings();
					}
				}));

		// Image settings
		containerEl.createEl('h3', { text: 'Image Settings' });

		new Setting(containerEl)
			.setName('Show cover images')
			.setDesc('Whether to display book cover images')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCoverImages)
				.onChange(async (value) => {
					this.plugin.settings.showCoverImages = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Image size')
			.setDesc('Cover image size (S: Small, M: Medium, L: Large)')
			.addDropdown(dropdown => dropdown
				.addOption('S', 'Small (S)')
				.addOption('M', 'Medium (M)')
				.addOption('L', 'Large (L)')
				.setValue(this.plugin.settings.coverImageSize)
				.onChange(async (value) => {
					this.plugin.settings.coverImageSize = value as 'S' | 'M' | 'L';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Save cover images locally')
			.setDesc('Whether to download and save cover images locally')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.saveCoverLocally)
				.onChange(async (value) => {
					this.plugin.settings.saveCoverLocally = value;
					await this.plugin.saveSettings();
				}));

		// Auto update settings
		containerEl.createEl('h3', { text: 'Auto Update' });

		new Setting(containerEl)
			.setName('Auto update timestamp')
			.setDesc('Whether to automatically update the updated field when book information is modified')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoUpdateTimestamp)
				.onChange(async (value) => {
					this.plugin.settings.autoUpdateTimestamp = value;
					await this.plugin.saveSettings();
				}));

		// Default values
		containerEl.createEl('h3', { text: 'Default Values' });

		new Setting(containerEl)
			.setName('Default reading status')
			.setDesc('Default reading status for newly added books')
			.addDropdown(dropdown => dropdown
				.addOption('unread', 'Unread')
				.addOption('reading', 'Reading')
				.setValue(this.plugin.settings.defaultStatus)
				.onChange(async (value) => {
					this.plugin.settings.defaultStatus = value as 'unread' | 'reading';
					await this.plugin.saveSettings();
				}));
	}
}
