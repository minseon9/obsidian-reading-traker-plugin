import { Plugin, MarkdownView, TFile, TAbstractFile, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, BookshelfSettings } from "./settings/types";
import { BookshelfSettingTab } from "./settings/settingTab";
import { registerCommands } from "./commands";
import { FolderManager } from "./services/pathService/folderManager";
import { PathManager } from "./services/pathService/pathManager";
import { FrontmatterParser } from "./services/frontmatterService/frontmatterParser";
import { FrontmatterCreator } from "./services/frontmatterService/frontmatterCreator";
import { SearchModal } from "./views/bookSearchModal";
import { ProgressUpdateModal } from "./views/progressUpdateModal";
import { getCurrentDateTime, setTimezoneOffset } from "./utils/dateUtils";
import { registerBasesBookshelfView, unregisterBasesViews } from "./services/obsidian/bases/basesViewRegistrar";
import { BookshelfBaseFileGenerator } from "./services/obsidian/baseFileGenerators/bookshelfBaseFileGenerator";
import { LibraryBaseFileGenerator } from "./services/obsidian/baseFileGenerators/libraryBaseFileGenerator";
import { StatisticsBaseFileGenerator } from "./services/obsidian/baseFileGenerators/statisticsBaseFileGenerator";

export default class BookshelfPlugin extends Plugin {
	settings: BookshelfSettings;

	async onload() {
		await this.loadSettings();
		
		// Initialize timezone offset
		setTimezoneOffset(this.settings.timezone);

		const folderManager = new FolderManager(this.app);
		try {
			await folderManager.ensureFolder(this.settings.bookFolder);
			await folderManager.ensureFolder(PathManager.getBooksFolderPath(this.settings.bookFolder));
			await folderManager.ensureFolder(PathManager.getInteractionFolderPath(this.settings.bookFolder));
			await folderManager.ensureFolder(PathManager.getViewsFolderPath(this.settings.bookFolder));
			
			// Create default .base files if they don't exist
			await this.ensureDefaultBaseFiles();
		} catch (error) {
			console.error('Failed to initialize Bookshelf folders:', error);
			// Continue plugin loading even if folder creation fails
		}

		// Add settings tab
		this.addSettingTab(new BookshelfSettingTab(this.app, this));

		// Register commands
		registerCommands(this.app, this);

		// Register Bases views
		await registerBasesBookshelfView(this);

		// Add command to open view
		this.addCommand({
			id: 'open-view',
			name: 'Open view',
			callback: () => {
				void this.activateView();
			},
		});

		// Add Ribbon icons (Left Navigation Bar)
		this.addRibbonIcon('book-open-text', 'Open bookshelf', () => {
			void this.activateView();
		});

		this.addRibbonIcon('book-plus', 'Search and add book', () => {
			const modal = new SearchModal(this.app, this);
			modal.open();
		});

		// Add progress update button to book notes
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file instanceof TFile) {
					void this.addProgressButtonToNote(file);
				}
			})
		);

		// Add button to currently open file if it's a book note
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			void this.addProgressButtonToNote(activeFile);
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

		const booksFolder = PathManager.getBooksFolderPath(this.settings.bookFolder);
		if (!file.path.startsWith(booksFolder)) {
			return;
		}

		// Wait for view to be ready
		setTimeout(() => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;

			// Try to find header element using containerEl
			const viewEl = view.containerEl;
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
					const contentContainer = viewEl.querySelector('.markdown-source-view') || viewEl.querySelector('.markdown-preview-view');
					if (!contentContainer) return;
					
					const buttonContainer = contentContainer.createEl('div', {
						cls: 'bookshelf-action-container',
					});
					if (contentContainer.firstChild) {
						contentContainer.insertBefore(buttonContainer, contentContainer.firstChild);
					}
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
			text: 'Update progress',
		});

		button.addEventListener('click', () => {
			// Get the currently active file to ensure we're updating the correct one
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				const modal = new ProgressUpdateModal(this.app, this, activeFile);
				modal.open();
			}
		});
		}, 200);
	}

	onunload(): void {
		void unregisterBasesViews(this);
	}

	/**
	 * Register auto-update timestamp (public for settings tab)
	 */
	registerAutoUpdateTimestamp(): void {
		const booksFolder = PathManager.getBooksFolderPath(this.settings.bookFolder);

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
					const { frontmatter, body } = FrontmatterParser.extract(content);

					// Only update if it's a book note (has title)
					if (!frontmatter.title) {
						return;
					}

					// Update timestamp
					frontmatter.updated = getCurrentDateTime();

					const frontmatterString = FrontmatterCreator.create(frontmatter);
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

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const viewsFolder = PathManager.getViewsFolderPath(this.settings.bookFolder);
		const baseFilePath = normalizePath(`${viewsFolder}/bookshelf-default.base`);

		// Open Bases view
		const baseFile = this.app.vault.getAbstractFileByPath(baseFilePath);
		if (baseFile && baseFile instanceof TFile) {
			// Open the .base file in a new leaf
		const leaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
		await leaf.openFile(baseFile);
		await workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Ensure default .base files exist
	 */
	private async ensureDefaultBaseFiles(): Promise<void> {
		const viewsFolder = PathManager.getViewsFolderPath(this.settings.bookFolder);

		// Create all default .base files
		const baseFiles = [
			{ path: `${viewsFolder}/bookshelf-default.base`, generator: BookshelfBaseFileGenerator },
			{ path: `${viewsFolder}/library.base`, generator: LibraryBaseFileGenerator },
			{ path: `${viewsFolder}/statistics.base`, generator: StatisticsBaseFileGenerator },
		];

		for (const { path, generator } of baseFiles) {
			const filePath = normalizePath(path);
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (!existingFile) {
				try {
					const content = generator.generate(this.settings);
					await this.app.vault.create(filePath, content);
				} catch (error) {
					console.error(`[Bookshelf] Failed to create ${filePath}:`, error);
				}
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<BookshelfSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update timezone offset when settings are saved
		setTimezoneOffset(this.settings.timezone);
	}
}
