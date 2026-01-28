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
	private currentOffset: number = 0;
	private hasMoreResults: boolean = false;
	private isLoadingMore: boolean = false;

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

		// Error message container (will be created dynamically)

		// Results container (scrollable)
		this.resultsContainer = contentEl.createEl('div', {
			cls: 'bookshelf-search-results',
		});
		this.resultsContainer.style.cssText = 'max-height: 60vh; overflow-y: auto; margin-top: 16px;';

		// Add scroll listener for infinite scroll
		this.resultsContainer.addEventListener('scroll', () => {
			this.handleScroll();
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
			this.currentResults = [];
			this.currentOffset = 0;
			this.hasMoreResults = false;
			return;
		}

		this.showLoading();
		this.hideError();
		this.currentResults = [];
		this.currentOffset = 0;
		this.hasMoreResults = false;

		// Debounce search: wait 500ms after user stops typing
		this.searchTimeout = setTimeout(() => {
			this.performSearch(query, 0);
		}, 500);
	}

	/**
	 * Perform search
	 */
	private async performSearch(query: string, offset: number = 0) {
		try {
			const limit = this.plugin.settings.searchResultLimit || 20;
			const results = await this.openLibraryClient.searchBooks(query, limit, offset);
			
			if (offset === 0) {
				this.currentResults = results;
			} else {
				this.currentResults = [...this.currentResults, ...results];
			}
			
			// Check if there are more results (assuming if we got full limit, there might be more)
			this.hasMoreResults = results.length === limit;
			this.currentOffset = offset + results.length;
			
			this.renderResults(this.currentResults);
			this.hideLoading();
			this.isLoadingMore = false;
		} catch (error) {
			this.hideLoading();
			this.showError('Failed to search books. Please try again later.');
			if (offset === 0) {
				this.resultsContainer.empty();
			}
			this.isLoadingMore = false;
		}
	}

	/**
	 * Handle scroll for infinite scroll
	 */
	private handleScroll() {
		if (this.isLoadingMore || !this.hasMoreResults) return;

		const container = this.resultsContainer;
		const scrollTop = container.scrollTop;
		const scrollHeight = container.scrollHeight;
		const clientHeight = container.clientHeight;

		// Load more when user scrolls to 80% of the container
		if (scrollTop + clientHeight >= scrollHeight * 0.8) {
			this.loadMoreResults();
		}
	}

	/**
	 * Load more search results
	 */
	private async loadMoreResults() {
		if (this.isLoadingMore || !this.hasMoreResults) return;

		const query = this.searchInput.value.trim();
		if (!query) return;

		this.isLoadingMore = true;
		await this.performSearch(query, this.currentOffset);
	}

	/**
	 * Render search results
	 */
	private renderResults(results: Book[]) {
		// Only clear if this is a new search (offset 0)
		if (this.currentOffset === results.length) {
			this.resultsContainer.empty();
		}

		if (results.length === 0 && this.currentOffset === 0) {
			this.resultsContainer.createEl('div', {
				cls: 'bookshelf-no-results',
				text: 'No books found. Try a different search query.',
			});
			return;
		}

		results.forEach((book, index) => {
			// Skip if already rendered (for infinite scroll)
			if (index < this.currentOffset - results.length) {
				return;
			}
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

		// Show loading indicator at bottom if loading more
		if (this.isLoadingMore) {
			const loadingEl = this.resultsContainer.createEl('div', {
				cls: 'bookshelf-loading-more',
				text: 'Loading more...',
			});
			loadingEl.style.cssText = 'text-align: center; padding: 16px; color: var(--text-muted);';
		}
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

			// Try to get detailed book information from Books API using ISBN
			// This is important for getting accurate totalPages and other detailed info
			let detailedBook: Book = book;
			if (book.isbn13) {
				const booksApiBook = await this.openLibraryClient.getBookByISBN(book.isbn13);
				if (booksApiBook) {
					// Merge: prefer Books API data for detailed fields, keep search result as fallback
					detailedBook = {
						...book,
						...booksApiBook,
						// Prefer Books API totalPages (most accurate)
						totalPages: booksApiBook.totalPages || book.totalPages,
						// Keep original cover if Books API doesn't have one
						coverUrl: booksApiBook.coverUrl || book.coverUrl,
						// Keep original title/author if Books API is missing
						title: booksApiBook.title || book.title,
						author: booksApiBook.author.length > 0 ? booksApiBook.author : book.author,
						// Prefer Books API publisher and publishDate
						publisher: booksApiBook.publisher || book.publisher,
						publishDate: booksApiBook.publishDate || book.publishDate,
					};
				}
			} else if (book.isbn10) {
				const booksApiBook = await this.openLibraryClient.getBookByISBN(book.isbn10);
				if (booksApiBook) {
					detailedBook = {
						...book,
						...booksApiBook,
						// Prefer Books API totalPages (most accurate)
						totalPages: booksApiBook.totalPages || book.totalPages,
						coverUrl: booksApiBook.coverUrl || book.coverUrl,
						title: booksApiBook.title || book.title,
						author: booksApiBook.author.length > 0 ? booksApiBook.author : book.author,
						publisher: booksApiBook.publisher || book.publisher,
						publishDate: booksApiBook.publishDate || book.publishDate,
					};
				}
			}

			// Set default status from settings
			const bookWithStatus: Book = {
				...detailedBook,
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
			const createdFile = await this.fileManager.createBookNote(
				bookWithStatus,
				this.plugin.settings.bookFolder
			);

			// Show success message
			this.showSuccess(`Book "${bookWithStatus.title}" added successfully!`);
			
			// Force Bases views to refresh by triggering a workspace update
			// Bases should auto-detect new files, but we can help it along
			try {
				// Trigger a workspace refresh event that Bases listens to
				this.app.vault.trigger('modify', createdFile);
				
				// Also try to refresh any open Bases views
				this.app.workspace.iterateAllLeaves((leaf) => {
					if (leaf.view?.getViewType?.() === 'bases') {
						const basesView = leaf.view as any;
						// Try to trigger refresh if available
						if (typeof basesView.requestUpdate === 'function') {
							basesView.requestUpdate();
						} else if (typeof basesView.refresh === 'function') {
							basesView.refresh();
						}
					}
				});
			} catch (e) {
				// Ignore errors - Bases should auto-detect anyway
				console.debug('[Bookshelf] Error triggering Bases refresh:', e);
			}
			
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
	 * Show error message with nice UI
	 */
	private showError(message: string) {
		// Remove any existing messages
		const existing = this.contentEl.querySelector('.bookshelf-message');
		if (existing) existing.remove();

		const messageContainer = this.contentEl.createEl('div', {
			cls: 'bookshelf-message bookshelf-message-error',
		});

		const icon = messageContainer.createEl('div', {
			cls: 'bookshelf-message-icon',
			text: '?',
		});

		const text = messageContainer.createEl('div', {
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

	/**
	 * Hide error message
	 */
	private hideError() {
		const existing = this.contentEl.querySelector('.bookshelf-message');
		if (existing) existing.remove();
	}

	/**
	 * Show success message with nice UI
	 */
	private showSuccess(message: string) {
		// Remove any existing messages
		const existing = this.contentEl.querySelector('.bookshelf-message');
		if (existing) existing.remove();

		const messageContainer = this.contentEl.createEl('div', {
			cls: 'bookshelf-message bookshelf-message-success',
		});

		const icon = messageContainer.createEl('div', {
			cls: 'bookshelf-message-icon',
			text: '?',
		});

		const text = messageContainer.createEl('div', {
			cls: 'bookshelf-message-text',
			text: message,
		});

		const closeButton = messageContainer.createEl('button', {
			cls: 'bookshelf-message-close',
			text: 'Close',
		});
		closeButton.addEventListener('click', () => {
			messageContainer.remove();
		});
	}
}
