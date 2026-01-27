import { Plugin, MarkdownView, TFile, TAbstractFile } from 'obsidian';
import { DEFAULT_SETTINGS, BookshelfSettings, BookshelfSettingTab } from "./settings";
import { registerCommands } from "./commands";
import { FileManagerUtils } from "./utils/fileManagerUtils";
import { BookshelfView } from "./views/bookshelfView";
import { SearchModal } from "./views/searchModal";
import { ProgressUpdateModal } from "./views/progressModal";

export default class BookshelfPlugin extends Plugin {
	settings: BookshelfSettings;

	async onload() {
		await this.loadSettings();

		// Ensure default folders exist
		const fileManager = new FileManagerUtils(this.app);
		await fileManager.ensureFolder(this.settings.bookFolder);
		await fileManager.ensureFolder(fileManager.getBooksFolderPath(this.settings.bookFolder));
		await fileManager.ensureFolder(fileManager.getInteractionFolderPath(this.settings.bookFolder));

		// Add settings tab
		this.addSettingTab(new BookshelfSettingTab(this.app, this));

		// Register commands
		registerCommands(this.app, this);

		// Register view
		this.registerView('bookshelf-view', (leaf) => new BookshelfView(leaf, this));

		// Add command to open view
		this.addCommand({
			id: 'bookshelf-open-view',
			name: 'Open Bookshelf',
			callback: () => {
				this.activateView();
			},
		});

		// Add Ribbon icons (Left Navigation Bar)
		this.addRibbonIcon('book-open', 'Open Bookshelf', () => {
			this.activateView();
		});

		this.addRibbonIcon('plus-circle', 'Search and Add Book', () => {
			const modal = new SearchModal(this.app, this);
			modal.open();
		});

		// Add progress update button to book notes
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file instanceof TFile) {
					this.addProgressButtonToNote(file);
				}
			})
		);

		// Add button to currently open file if it's a book note
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			this.addProgressButtonToNote(activeFile);
		}

		// Register auto-update timestamp if enabled
		if (this.settings.autoUpdateTimestamp) {
			this.registerAutoUpdateTimestamp();
		}
	}

	/**
	 * Add progress update button to book note
	 */
	private async addProgressButtonToNote(file: TFile): Promise<void> {
		if (!file || file.extension !== 'md') {
			return;
		}

		// Check if file is in books folder
		const booksFolder = new FileManagerUtils(this.app).getBooksFolderPath(this.settings.bookFolder);
		if (!file.path.startsWith(booksFolder)) {
			return;
		}

		// Wait for view to be ready
		setTimeout(() => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;

			// Try to find header element
			const viewEl = (view as any).containerEl || (view as any).contentEl;
			if (!viewEl) return;

			// Find or create action items container
			let actionContainer = viewEl.querySelector('.bookshelf-action-container');
			if (!actionContainer) {
				// Try to find existing header
				const header = viewEl.querySelector('.view-header') || viewEl.querySelector('.view-header-title-container');
				if (header) {
					actionContainer = header;
				} else {
					// Create container at the top of content
					actionContainer = viewEl.querySelector('.markdown-source-view') || viewEl.querySelector('.markdown-preview-view');
					if (!actionContainer) return;
					
					const buttonContainer = actionContainer.createEl('div', {
						cls: 'bookshelf-action-container',
					});
					actionContainer.insertBefore(buttonContainer, actionContainer.firstChild);
					actionContainer = buttonContainer;
				}
			}

			// Check if button already exists
			if (actionContainer.querySelector('.bookshelf-progress-button')) {
				return;
			}

			// Add button
			const button = actionContainer.createEl('button', {
				cls: 'bookshelf-progress-button mod-cta',
				text: 'Update Progress',
			});

			button.addEventListener('click', () => {
				const modal = new ProgressUpdateModal(this.app, this, file);
				modal.open();
			});
		}, 200);
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType('bookshelf-view');
	}

	/**
	 * Register auto-update timestamp (public for settings tab)
	 */
	registerAutoUpdateTimestamp(): void {
		const fileManager = new FileManagerUtils(this.app);
		const booksFolder = fileManager.getBooksFolderPath(this.settings.bookFolder);

		// Listen for file modifications
		this.registerEvent(
			this.app.vault.on('modify', async (file: TAbstractFile) => {
				// Only process markdown files in books folder
				if (!(file instanceof TFile) || file.extension !== 'md' || !file.path.startsWith(booksFolder)) {
					return;
				}

				// Skip if auto-update is disabled
				if (!this.settings.autoUpdateTimestamp) {
					return;
				}

				try {
					const content = await this.app.vault.read(file);
					const frontmatterProcessor = (fileManager as any).frontmatterProcessor;
					const { frontmatter, body } = frontmatterProcessor.extractFrontmatter(content);

					// Only update if it's a book note (has title)
					if (!frontmatter.title) {
						return;
					}

					// Update timestamp
					const { getCurrentDateTime } = require('./utils/dateUtils');
					frontmatter.updated = getCurrentDateTime();

					// Reconstruct content
					const frontmatterString = frontmatterProcessor.createFrontmatter(frontmatter);
					const newContent = `${frontmatterString}\n${body}`;

					// Write back (avoid infinite loop by checking if changed)
					if (content !== newContent) {
						await this.app.vault.modify(file, newContent);
					}
				} catch (error) {
					// Silently ignore errors (e.g., file is being edited)
					console.debug('Auto-update timestamp error:', error);
				}
			})
		);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType('bookshelf-view')[0];
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({ type: 'bookshelf-view', active: true });
				leaf = rightLeaf;
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<BookshelfSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
