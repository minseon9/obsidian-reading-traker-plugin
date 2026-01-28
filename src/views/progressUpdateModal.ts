import {App, Modal, Setting} from 'obsidian';
import {Book} from '../models/book';
import {ReadingRecord} from '../models/readingRecord';
import {getLastEndPage} from '../models/readingRecordFactory';
import {BookFileReader} from '../services/bookFileService/bookFileReader';
import {BookFileUpdater} from '../services/bookFileService/bookFileUpdater';
import BookshelfPlugin from '../main';

/**
 * Progress update modal
 */
export class ProgressUpdateModal extends Modal {
	private plugin: BookshelfPlugin;
	private bookFileReader: BookFileReader;
	private bookFileUpdater: BookFileUpdater;
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
		this.bookFileReader = new BookFileReader(app);
		this.bookFileUpdater = new BookFileUpdater(app);
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
			const bookData = await this.bookFileReader.read(this.file);
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

		// Get previous reading history from frontmatter summary (faster)
		this.app.vault.read(this.file).then(async content => {
					const { FrontmatterParser } = await import('../services/frontmatterService/frontmatterParser');
			const { frontmatter } = FrontmatterParser.extract(content);
			// Use reading_history_summary from frontmatter for statistics
			const historySummary = frontmatter.reading_history_summary || [];
			const history: ReadingRecord[] = historySummary.map((item: any) => ({
				date: item.date || '',
				startPage: item.startPage || 0,
				endPage: item.endPage || 0,
				pagesRead: item.pagesRead || 0,
				timestamp: item.timestamp,
			}));
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

			// Notes input (large text area, like Obsidian editor)
			const notesSetting = new Setting(container)
				.setName('Notes (optional)')
				.setDesc('Add notes about this reading session');
			
			// Create a larger textarea
			this.notesInput = notesSetting.controlEl.createEl('textarea', {
				cls: 'bookshelf-notes-input',
			});
			this.notesInput.placeholder = 'What did you read? Any thoughts?';
			this.notesInput.style.cssText = `
				width: 100%;
				min-height: 300px;
				padding: 12px;
				font-size: 14px;
				line-height: 1.6;
				font-family: var(--font-text);
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background-color: var(--background-primary);
				color: var(--text-normal);
				resize: vertical;
				margin-top: 8px;
			`;

			// Update calculations initially
			this.updateCalculations();

			// Update button only (no cancel button)
			const buttonContainer = container.createEl('div', {
				cls: 'bookshelf-progress-buttons',
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
		const pagesRead = Math.max(0, endPage - startPage);
		let notes = this.notesInput.value.trim() || undefined;

		// Check if notes are required
		if (this.plugin.settings.requireReadingNotes && !notes) {
			this.showErrorMessage('Notes are required when updating progress.');
			return;
		}

		if (endPage < startPage) {
			this.showErrorMessage('End page must be greater than or equal to start page.');
			return;
		}

		try {
			await this.bookFileUpdater.updateReadingProgress(
				this.file, 
				endPage,
				startPage,
				notes,
				this.plugin.settings.autoStatusChange
			);

			// Show success message with better UI
			this.showSuccessMessage('Progress updated successfully!');
		} catch (error) {
			this.showErrorMessage(`Failed to update progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Show success message with Obsidian-style UI
	 */
	private showSuccessMessage(message: string): void {
		// Remove any existing messages
		const existing = this.contentEl.querySelector('.bookshelf-progress-success');
		if (existing) existing.remove();

		// Create simple success message with Obsidian accent color at the bottom
		const messageContainer = this.contentEl.createEl('div', {
			cls: 'bookshelf-progress-success',
		});
		messageContainer.style.cssText = 'padding: 12px; margin-top: 16px; background-color: transparent; color: var(--interactive-accent); font-size: 14px; text-align: center; font-weight: 500;';

		const text = messageContainer.createEl('span', {
			text: message,
		});

		// Auto-close after 2 seconds
		setTimeout(() => {
			this.close();
		}, 2000);
	}

	/**
	 * Show error message with nice UI
	 */
	private showErrorMessage(message: string): void {
		// Remove any existing messages
		const existing = this.contentEl.querySelector('.bookshelf-message');
		if (existing) existing.remove();

		const messageContainer = this.contentEl.createEl('div', {
			cls: 'bookshelf-message bookshelf-message-error',
		});

		const iconEl = messageContainer.createEl('div', {
			cls: 'bookshelf-message-icon',
			text: '!',
		});

		const textEl = messageContainer.createEl('div', {
			cls: 'bookshelf-message-text',
			text: message,
		});

		const closeButton = messageContainer.createEl('button', {
			cls: 'bookshelf-message-close',
			text: 'Dismiss',
		});

		closeButton.addEventListener('click', () => {
			messageContainer.remove();
		});
	}
}
