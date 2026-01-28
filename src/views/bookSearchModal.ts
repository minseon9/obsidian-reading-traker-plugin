import { App, Modal, Setting, TFile } from 'obsidian';
import { Book } from '../models/book';
import { OpenLibraryClient } from '../apis/openLibrary';
import { BookFileCreator } from '../services/bookFileService/bookFileCreator';
import { BookFileReader } from '../services/bookFileService/bookFileReader';
import { PathManager } from '../services/pathService/pathManager';
import BookshelfPlugin from '../main';

export class SearchModal extends Modal {
	private plugin: BookshelfPlugin;
	private searchInput: HTMLInputElement;
	private resultsContainer: HTMLElement;
	private loadingIndicator: HTMLElement;
	private errorMessage: HTMLElement;
	private openLibraryClient: OpenLibraryClient;
	private bookFileCreator: BookFileCreator;
	private bookFileReader: BookFileReader;
	private searchTimeout: NodeJS.Timeout | null = null;
	private currentResults: Book[] = [];
	private currentOffset: number = 0;
	private hasMoreResults: boolean = false;
	private isLoadingMore: boolean = false;

	constructor(app: App, plugin: BookshelfPlugin) {
		super(app);
		this.plugin = plugin;
		this.openLibraryClient = new OpenLibraryClient(this.plugin.settings.apiTimeout);
		this.bookFileCreator = new BookFileCreator(app);
		this.bookFileReader = new BookFileReader(app);
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

		this.searchTimeout = setTimeout(() => {
			this.performSearch(query, 0);
		}, 500);
	}

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
		if (scrollTop + clientHeight >= scrollHeight * 0.8) {
			this.loadMoreResults();
		}
	}

	private async loadMoreResults() {
		if (this.isLoadingMore || !this.hasMoreResults) return;

		const query = this.searchInput.value.trim();
		if (!query) return;

		this.isLoadingMore = true;
		await this.performSearch(query, this.currentOffset);
	}

	private renderResults(results: Book[]) {
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

	private async addBook(book: Book) {
		try {
			this.setButtonsState(true, 'Adding...');
			const detailedBook = await this.fetchDetailedBookInfo(book);
			const bookWithStatus = { ...detailedBook, status: this.plugin.settings.defaultStatus };
			await this.validateBookNotExists(bookWithStatus);
			const createdFile = await this.bookFileCreator.create(bookWithStatus, this.plugin.settings.bookFolder);
			this.showSuccess(`Book "${bookWithStatus.title}" added successfully!`);
			this.triggerViewRefresh(createdFile);
			setTimeout(() => this.close(), 1000);
			this.setButtonsState(false, 'Add Book');
		} catch (error) {
			this.showError(`Failed to add book: ${error instanceof Error ? error.message : 'Unknown error'}`);
			this.setButtonsState(false, 'Add Book');
		}
	}

	private async fetchDetailedBookInfo(book: Book): Promise<Book> {
		if (!book.coverEditionKey) {
			return book;
		}

		const booksApiBook = await this.openLibraryClient.getBookByOLID(book.coverEditionKey);
		if (!booksApiBook) {
			return book;
		}

		return {
			...book,
			...booksApiBook,
			totalPages: booksApiBook.totalPages || book.totalPages,
			coverUrl: booksApiBook.coverUrl || book.coverUrl,
			title: booksApiBook.title || book.title,
			author: booksApiBook.author.length > 0 ? booksApiBook.author : book.author,
			publisher: booksApiBook.publisher || book.publisher,
			publishDate: booksApiBook.publishDate || book.publishDate,
		};
	}

	private async validateBookNotExists(book: Book): Promise<void> {
		const booksFolder = PathManager.getBooksFolderPath(this.plugin.settings.bookFolder);
		const existingFile = await this.bookFileReader.findExisting(booksFolder, book.title);
		if (existingFile) {
			throw new Error(`Book "${book.title}" already exists.`);
		}
	}

	private setButtonsState(disabled: boolean, text: string): void {
		const buttons = this.resultsContainer.querySelectorAll('button');
		buttons.forEach(btn => {
			btn.disabled = disabled;
			btn.textContent = text;
		});
	}

	private triggerViewRefresh(file: TFile): void {
		try {
			this.app.vault.trigger('modify', file);
			this.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view?.getViewType?.() === 'bases') {
					const basesView = leaf.view as any;
					if (typeof basesView.requestUpdate === 'function') {
						basesView.requestUpdate();
					} else if (typeof basesView.refresh === 'function') {
						basesView.refresh();
					}
				}
			});
		} catch (e) {
			console.debug('[Bookshelf] Error triggering Bases refresh:', e);
		}
	}

	private showLoading() {
		this.loadingIndicator.style.display = 'block';
	}

	private hideLoading() {
		this.loadingIndicator.style.display = 'none';
	}

	private showError(message: string) {
		const existing = this.contentEl.querySelector('.bookshelf-message');
		if (existing) existing.remove();

		const messageContainer = this.contentEl.createEl('div', {
			cls: 'bookshelf-message bookshelf-message-error',
		});

		messageContainer.createEl('div', { cls: 'bookshelf-message-icon', text: '!' });
		messageContainer.createEl('div', { cls: 'bookshelf-message-text', text: message });

		const closeButton = messageContainer.createEl('button', {
			cls: 'bookshelf-message-close',
			text: 'Dismiss',
		});
		closeButton.addEventListener('click', () => messageContainer.remove());
	}

	private hideError() {
		const existing = this.contentEl.querySelector('.bookshelf-message');
		if (existing) existing.remove();
	}

	private showSuccess(message: string) {
		const existing = this.contentEl.querySelector('.bookshelf-message-success');
		if (existing) existing.remove();

		// Create simple success message with Obsidian accent color at the bottom
		const messageContainer = this.contentEl.createEl('div', {
			cls: 'bookshelf-message-success',
		});
		messageContainer.style.cssText = 'padding: 12px; margin-top: 16px; background-color: transparent; color: var(--interactive-accent); font-size: 14px; text-align: center; font-weight: 500;';

		messageContainer.createEl('span', {
			text: message,
		});
	}
}
