import { App, Modal, Setting } from 'obsidian';
import { Book } from '../models/book';
import { ReadingRecord, getLastEndPage } from '../models/readingRecord';
import { FileManagerUtils } from '../utils/fileManagerUtils';
import { getCurrentDate } from '../utils/dateUtils';
import BookshelfPlugin from '../main';

/**
 * Progress update modal
 */
export class ProgressUpdateModal extends Modal {
	private plugin: BookshelfPlugin;
	private fileManager: FileManagerUtils;
	private book: Book | null = null;
	private file: any; // TFile
	private startPageInput: HTMLInputElement;
	private endPageInput: HTMLInputElement;
	private pagesReadDisplay: HTMLElement;
	private progressDisplay: HTMLElement;
	private notesInput: HTMLTextAreaElement;

	constructor(app: App, plugin: BookshelfPlugin, file?: any) {
		super(app);
		this.plugin = plugin;
		this.fileManager = new FileManagerUtils(app);
		this.file = file || this.app.workspace.getActiveFile();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Update Reading Progress' });

		// Load book data
		this.loadBookData().then(() => {
			if (!this.book) {
				contentEl.createEl('div', {
					cls: 'bookshelf-error',
					text: 'No book data found. Please open a book note first.',
				});
				return;
			}

			this.renderForm(contentEl);
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load book data from current file
	 */
	private async loadBookData(): Promise<void> {
		if (!this.file) {
			return;
		}

		try {
			const bookData = await this.fileManager.getBookFromFile(this.file);
			if (bookData.title) {
				this.book = {
					title: bookData.title || 'Unknown',
					subtitle: bookData.subtitle,
					author: bookData.author || [],
					isbn10: bookData.isbn10,
					isbn13: bookData.isbn13,
					publisher: bookData.publisher,
					publishDate: bookData.publishDate,
					totalPages: bookData.totalPages,
					coverUrl: bookData.coverUrl,
					localCover: bookData.localCover,
					category: bookData.category || [],
					status: (bookData.status as any) || 'unread',
					readPage: bookData.readPage || 0,
					readStarted: bookData.readStarted,
					readFinished: bookData.readFinished,
					created: bookData.created || new Date().toISOString(),
					updated: bookData.updated || new Date().toISOString(),
				};
			}
		} catch (error) {
			console.error('Error loading book data:', error);
		}
	}

	/**
	 * Render the form
	 */
	private renderForm(container: HTMLElement): void {
		if (!this.book || !this.file) return;

		// Book info display
		const bookInfo = container.createEl('div', {
			cls: 'bookshelf-progress-book-info',
		});
		bookInfo.createEl('div', {
			cls: 'bookshelf-progress-title',
			text: this.book.title,
		});
		if (this.book.author && this.book.author.length > 0) {
			bookInfo.createEl('div', {
				cls: 'bookshelf-progress-author',
				text: `by ${this.book.author.join(', ')}`,
			});
		}

		// Get previous reading history
		this.app.vault.read(this.file).then(content => {
			const frontmatterProcessor = (this.fileManager as any).frontmatterProcessor;
			const { frontmatter } = frontmatterProcessor.extractFrontmatter(content);
			const history: ReadingRecord[] = frontmatter.reading_history || [];
			const lastEndPage = getLastEndPage(history);
			const currentReadPage = this.book?.readPage || 0;

			// Start page input
			new Setting(container)
				.setName('Start page')
				.setDesc('Starting page for this reading session')
				.addText(text => {
					this.startPageInput = text.inputEl;
					this.startPageInput.type = 'number';
					this.startPageInput.value = lastEndPage > 0 ? lastEndPage.toString() : (currentReadPage || '0').toString();
					this.startPageInput.addEventListener('input', () => this.updateCalculations());
				});

			// End page input
			new Setting(container)
				.setName('End page')
				.setDesc('Current page you finished reading')
				.addText(text => {
					this.endPageInput = text.inputEl;
					this.endPageInput.type = 'number';
					this.endPageInput.value = (currentReadPage || '0').toString();
					this.endPageInput.addEventListener('input', () => this.updateCalculations());
				});

			// Pages read display
			const pagesReadContainer = container.createEl('div', {
				cls: 'bookshelf-progress-calc',
			});
			pagesReadContainer.createEl('div', {
				cls: 'bookshelf-progress-label',
				text: 'Pages read:',
			});
			this.pagesReadDisplay = pagesReadContainer.createEl('div', {
				cls: 'bookshelf-progress-value',
				text: '0',
			});

			// Progress display
			if (this.book && this.book.totalPages) {
				const progressContainer = container.createEl('div', {
					cls: 'bookshelf-progress-calc',
				});
				progressContainer.createEl('div', {
					cls: 'bookshelf-progress-label',
					text: 'Progress:',
				});
				this.progressDisplay = progressContainer.createEl('div', {
					cls: 'bookshelf-progress-value',
					text: '0%',
				});
			}

			// Notes input
			new Setting(container)
				.setName('Notes (optional)')
				.setDesc('Add notes about this reading session')
				.addTextArea(text => {
					this.notesInput = text.inputEl;
					this.notesInput.placeholder = 'What did you read? Any thoughts?';
					this.notesInput.rows = 3;
				});

			// Update calculations initially
			this.updateCalculations();

			// Buttons
			const buttonContainer = container.createEl('div', {
				cls: 'bookshelf-progress-buttons',
			});

			const cancelButton = buttonContainer.createEl('button', {
				text: 'Cancel',
			});
			cancelButton.addEventListener('click', () => {
				this.close();
			});

			const updateButton = buttonContainer.createEl('button', {
				cls: 'mod-cta',
				text: 'Update Progress',
			});
			updateButton.addEventListener('click', () => {
				this.updateProgress();
			});
		});
	}

	/**
	 * Update calculations (pages read, progress)
	 */
	private updateCalculations(): void {
		const startPage = parseInt(this.startPageInput.value, 10) || 0;
		const endPage = parseInt(this.endPageInput.value, 10) || 0;
		const pagesRead = Math.max(0, endPage - startPage);

		this.pagesReadDisplay.textContent = pagesRead.toString();

		if (this.book?.totalPages && this.progressDisplay) {
			const progress = Math.min((endPage / this.book.totalPages) * 100, 100);
			this.progressDisplay.textContent = `${Math.round(progress)}%`;
		}
	}

	/**
	 * Update progress
	 */
	private async updateProgress(): Promise<void> {
		if (!this.file || !this.book) {
			return;
		}

		const startPage = parseInt(this.startPageInput.value, 10) || 0;
		const endPage = parseInt(this.endPageInput.value, 10) || 0;
		let notes = this.notesInput.value.trim() || undefined;

		// Check if notes are required
		if (this.plugin.settings.requireReadingNotes && !notes) {
			const errorEl = this.contentEl.querySelector('.bookshelf-error') || this.contentEl.createEl('div', { cls: 'bookshelf-error' });
			errorEl.textContent = 'Notes are required when updating progress.';
			return;
		}

		if (endPage < startPage) {
			// Show error
			const errorEl = this.contentEl.querySelector('.bookshelf-error') || this.contentEl.createEl('div', { cls: 'bookshelf-error' });
			errorEl.textContent = 'End page must be greater than or equal to start page.';
			return;
		}

		try {
			await this.fileManager.updateReadingProgress(
				this.file, 
				endPage, 
				notes,
				this.plugin.settings.autoStatusChange
			);

			// Show notification if enabled
			if (this.plugin.settings.showProgressNotification) {
				// Refresh Bookshelf View if open
				const leaves = this.app.workspace.getLeavesOfType('bookshelf-view');
				leaves.forEach(leaf => {
					const view = leaf.view as any;
					if (view && typeof view.refresh === 'function') {
						view.refresh();
					}
				});
			}
			
			// Show success message
			const successEl = this.contentEl.createEl('div', {
				cls: 'bookshelf-success',
				text: 'Progress updated successfully!',
			});

			// Close modal after a short delay
			setTimeout(() => {
				this.close();
			}, 1000);
		} catch (error) {
			const errorEl = this.contentEl.querySelector('.bookshelf-error') || this.contentEl.createEl('div', { cls: 'bookshelf-error' });
			errorEl.textContent = `Failed to update progress: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}
	}
}
