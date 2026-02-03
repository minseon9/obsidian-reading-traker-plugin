import { App, PluginSettingTab, Setting } from "obsidian";
import BookshelfPlugin from "../main";

export class BookshelfSettingTab extends PluginSettingTab {
	plugin: BookshelfPlugin;

	constructor(app: App, plugin: BookshelfPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		
		new Setting(containerEl).setName('Folders').setHeading();
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

		new Setting(containerEl).setName('API').setHeading();
		new Setting(containerEl)
			.setName('Timeout (ms)')
			.setDesc('Timeout duration for open library requests (milliseconds)')
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

		new Setting(containerEl)
			.setName('Search result limit')
			.setDesc('Maximum number of search results to display')
			.addText(text => text
				.setPlaceholder('20')
				.setValue(this.plugin.settings.searchResultLimit.toString())
				.onChange(async (value) => {
					const limit = parseInt(value, 10);
					if (!isNaN(limit) && limit > 0) {
						this.plugin.settings.searchResultLimit = limit;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl).setName('Auto update').setHeading();
		new Setting(containerEl)
			.setName('Auto update timestamp')
			.setDesc('Whether to automatically update the updated field when book information is modified')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoUpdateTimestamp)
				.onChange(async (value) => {
					this.plugin.settings.autoUpdateTimestamp = value;
					await this.plugin.saveSettings();
					if (value) {
						this.plugin.registerAutoUpdateTimestamp();
					}
				}));

		new Setting(containerEl)
			.setName('Auto status change')
			.setDesc('Automatically change status to "finished" when read_page reaches total pages')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoStatusChange)
				.onChange(async (value) => {
					this.plugin.settings.autoStatusChange = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show progress notification')
			.setDesc('Show notification when progress is updated')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showProgressNotification)
				.onChange(async (value) => {
					this.plugin.settings.showProgressNotification = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Reading history').setHeading();
		new Setting(containerEl)
			.setName('Track reading history')
			.setDesc('Whether to track reading history (pages read per session)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackReadingHistory)
				.onChange(async (value) => {
					this.plugin.settings.trackReadingHistory = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Require reading notes')
			.setDesc('Require notes when updating reading progress')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.requireReadingNotes)
				.onChange(async (value) => {
					this.plugin.settings.requireReadingNotes = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('View').setHeading();
		new Setting(containerEl)
			.setName('Default sort order')
			.setDesc('Default sort order for bookshelf view')
			.addDropdown(dropdown => dropdown
				.addOption('date', 'Date')
				.addOption('title', 'Title')
				.addOption('author', 'Author')
				.addOption('progress', 'Progress')
				.setValue(this.plugin.settings.defaultSort)
				.onChange(async (value) => {
					this.plugin.settings.defaultSort = value as 'date' | 'title' | 'author' | 'progress';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Default values').setHeading();
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

		new Setting(containerEl).setName('Date & time').setHeading();
		new Setting(containerEl)
			.setName('Timezone offset')
			.setDesc('Timezone offset from UTC in hours (for example 0 for UTC, 9 for Korea, -5 for EST).')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(this.plugin.settings.timezone.toString())
				.onChange(async (value) => {
					const offset = parseFloat(value);
					if (!isNaN(offset) && offset >= -12 && offset <= 14) {
						this.plugin.settings.timezone = offset;
						await this.plugin.saveSettings();
					}
				}));
	}
}
