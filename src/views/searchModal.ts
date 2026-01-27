import { App, Modal, Setting } from 'obsidian';
import { Book } from '../models/book';
import { OpenLibraryClient } from '../apis/openLibrary';
import { FileManagerUtils } from '../utils/fileManagerUtils';
import BookshelfPlugin from '../main';

/**
 * Book search modal
 */
export class SearchModal extends Modal {
	private plugin: BookshelfPlugin;
	private searchInput: HTMLInputElement;
	private resultsContainer: HTMLElement;
	private loadingIndicator: HTMLElement;
	private errorMessage: HTMLElement;
	private openLibraryClient: OpenLibraryClient;
	private fileManager: FileManagerUtils;
	private searchTimeout: NodeJS.Timeout | null = null;
	private currentResults: Book[] = [];

	constructor(app: App, plugin: BookshelfPlugin) {
		super(app);
		this.plugin = plugin;
		this.openLibraryClient = new OpenLibraryClient(this.plugin.settings.apiTimeout);
		this.fileManager = new FileManagerUtils(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Search Books' });

		// Search input
		new Setting(contentEl)
			.setName('Search query')
			.setDesc('Enter book title, author, or ISBN')
			.addText(text => {
				this.searchInput = text.inputEl;
				this.searchInput.placeholder = 'Search for books...';
				this.searchInput.addEventListener('input', () => {
					this.handleSearchInput();
				});
			});

		// Loading indicator
		this.loadingIndicator = contentEl.createEl('div', {
			cls: 'bookshelf-loading',
			text: 'Searching...',
		});
		this.loadingIndicator.style.display = 'none';

		// Error message
		this.errorMessage = contentEl.createEl('div', {
			cls: 'bookshelf-error',
		});
		this.errorMessage.style.display = 'none';

		// Results container
		this.resultsContainer = contentEl.createEl('div', {
			cls: 'bookshelf-search-results',
		});

		// Focus on search input
		this.searchInput.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
			this.searchTimeout = null;
		}
	}

	/**
	 * Handle search input with debouncing
	 */
	private handleSearchInput() {
		const query = this.searchInput.value.trim();

		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
		}

		if (query.length < 2) {
			this.resultsContainer.empty();
			this.hideLoading();
			this.hideError();
			return;
		}

		this.showLoading();
		this.hideError();

		// Debounce search: wait 500ms after user stops typing
		this.searchTimeout = setTimeout(() => {
			this.performSearch(query);
		}, 500);
	}

	/**
	 * Perform search
	 */
	private async performSearch(query: string) {
		try {
			const limit = this.plugin.settings.searchResultLimit || 20;
			const results = await this.openLibraryClient.searchBooks(query, limit);
			this.currentResults = results;
			this.renderResults(results);
			this.hideLoading();
		} catch (error) {
			this.hideLoading();
			this.showError('Failed to search books. Please try again later.');
			this.resultsContainer.empty();
		}
	}

	/**
	 * Render search results
	 */
	private renderResults(results: Book[]) {
		this.resultsContainer.empty();

		if (results.length === 0) {
			this.resultsContainer.createEl('div', {
				cls: 'bookshelf-no-results',
				text: 'No books found. Try a different search query.',
			});
			return;
		}

		results.forEach((book, index) => {
			const resultItem = this.resultsContainer.createEl('div', {
				cls: 'bookshelf-result-item',
			});

			// Book cover image (if available)
			if (book.coverUrl) {
				const coverContainer = resultItem.createEl('div', {
					cls: 'bookshelf-result-cover',
				});
				const coverImg = coverContainer.createEl('img', {
					attr: {
						src: book.coverUrl,
						alt: book.title,
					},
				});
				coverImg.style.width = '80px';
				coverImg.style.height = '120px';
				coverImg.style.objectFit = 'cover';
			}

			// Book info
			const infoContainer = resultItem.createEl('div', {
				cls: 'bookshelf-result-info',
			});

			infoContainer.createEl('div', {
				cls: 'bookshelf-result-title',
				text: book.title,
			});

			if (book.author && book.author.length > 0) {
				infoContainer.createEl('div', {
					cls: 'bookshelf-result-author',
					text: `by ${book.author.join(', ')}`,
				});
			}

			if (book.publishDate) {
				infoContainer.createEl('div', {
					cls: 'bookshelf-result-meta',
					text: `Published: ${book.publishDate}`,
				});
			}

			if (book.publisher) {
				infoContainer.createEl('div', {
					cls: 'bookshelf-result-meta',
					text: `Publisher: ${book.publisher}`,
				});
			}

			// Add button
			const addButton = infoContainer.createEl('button', {
				cls: 'mod-cta',
				text: 'Add Book',
			});

			addButton.addEventListener('click', async () => {
				await this.addBook(book);
			});

			// Add separator (except for last item)
			if (index < results.length - 1) {
				resultItem.createEl('hr');
			}
		});
	}

	/**
	 * Add book to vault
	 */
	private async addBook(book: Book) {
		try {
			// Disable add button during processing
			const addButtons = this.resultsContainer.querySelectorAll('button');
			addButtons.forEach(btn => {
				btn.disabled = true;
				btn.textContent = 'Adding...';
			});

			// Set default status from settings
			const bookWithStatus: Book = {
				...book,
				status: this.plugin.settings.defaultStatus,
			};

			// Check if book already exists (books folder)
			const booksFolder = this.fileManager.getBooksFolderPath(this.plugin.settings.bookFolder);
			const existingFile = await this.fileManager.findExistingBookNote(
				booksFolder,
				bookWithStatus.title
			);

			if (existingFile) {
				this.showError(`Book "${bookWithStatus.title}" already exists.`);
				// Re-enable buttons
				addButtons.forEach(btn => {
					btn.disabled = false;
					btn.textContent = 'Add Book';
				});
				return;
			}

			// Create book note (uses books subfolder internally)
			await this.fileManager.createBookNote(
				bookWithStatus,
				this.plugin.settings.bookFolder,
				this.plugin.settings.templateFile
			);

			// Show success message
			this.showSuccess(`Book "${bookWithStatus.title}" added successfully!`);
			
			// Close modal after a short delay
			setTimeout(() => {
				this.close();
			}, 1000);
		} catch (error) {
			this.showError(`Failed to add book: ${error instanceof Error ? error.message : 'Unknown error'}`);
			// Re-enable buttons
			const addButtons = this.resultsContainer.querySelectorAll('button');
			addButtons.forEach(btn => {
				btn.disabled = false;
				btn.textContent = 'Add Book';
			});
		}
	}

	/**
	 * Show loading indicator
	 */
	private showLoading() {
		this.loadingIndicator.style.display = 'block';
	}

	/**
	 * Hide loading indicator
	 */
	private hideLoading() {
		this.loadingIndicator.style.display = 'none';
	}

	/**
	 * Show error message
	 */
	private showError(message: string) {
		this.errorMessage.textContent = message;
		this.errorMessage.style.display = 'block';
		this.errorMessage.style.color = 'var(--text-error)';
	}

	/**
	 * Hide error message
	 */
	private hideError() {
		this.errorMessage.style.display = 'none';
	}

	/**
	 * Show success message
	 */
	private showSuccess(message: string) {
		this.errorMessage.textContent = message;
		this.errorMessage.style.display = 'block';
		this.errorMessage.style.color = 'var(--text-success)';
	}
}
