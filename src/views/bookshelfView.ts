import { ItemView, TFile, TFolder } from 'obsidian';
import { Book, BookStatus } from '../models/book';
import { FileManagerUtils } from '../utils/fileManagerUtils';
import { BookCard } from './bookCard';
import BookshelfPlugin from '../main';

/**
 * Bookshelf View - Main view for displaying all books
 */
export class BookshelfView extends ItemView {
	private plugin: BookshelfPlugin;
	private fileManager: FileManagerUtils;
	private books: Array<{ book: Book; file: TFile }> = [];
	private currentFilter: BookStatus | 'all' = 'all';
	private currentSort: 'date' | 'title' | 'author' | 'progress' = 'date';
	private layout: 'grid' | 'list' = 'grid';

	async onOpen() {
		// Load settings for default layout and sort
		this.layout = this.plugin.settings.viewLayout || 'grid';
		this.currentSort = this.plugin.settings.defaultSort || 'date';
		
		await this.loadBooks();
		this.render();
	}

	constructor(leaf: any, plugin: BookshelfPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.fileManager = new FileManagerUtils(this.app);
	}

	getViewType(): string {
		return 'bookshelf-view';
	}

	getDisplayText(): string {
		return 'Bookshelf';
	}

	getIcon(): string {
		return 'book-open';
	}

	async onClose() {
		// Cleanup if needed
	}

	/**
	 * Load books from vault
	 */
	private async loadBooks(): Promise<void> {
		this.books = [];

		// Load from books subfolder
		const booksFolderPath = this.fileManager.getBooksFolderPath(
			this.plugin.settings.bookFolder
		);

		const folder = this.app.vault.getAbstractFileByPath(booksFolderPath);

		if (!folder || !(folder instanceof TFolder)) {
			return;
		}

		const files = folder.children.filter(
			(file): file is TFile => file instanceof TFile && file.extension === 'md'
		);

		for (const file of files) {
			try {
				const bookData = await this.fileManager.getBookFromFile(file);
				if (bookData.title) {
					const book: Book = {
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
						status: (bookData.status as BookStatus) || 'unread',
						readPage: bookData.readPage,
						readStarted: bookData.readStarted,
						readFinished: bookData.readFinished,
						created: bookData.created || new Date().toISOString(),
						updated: bookData.updated || new Date().toISOString(),
					};
					this.books.push({ book, file });
				}
			} catch (error) {
				console.error(`Error loading book from ${file.path}:`, error);
			}
		}
	}

	/**
	 * Render the view
	 */
	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		// Header
		const header = container.createEl('div', {
			cls: 'bookshelf-header',
		});

		// Filter buttons
		const filterContainer = header.createEl('div', {
			cls: 'bookshelf-filters',
		});

		const filterButtons = [
			{ label: 'All', value: 'all' as const },
			{ label: 'Unread', value: 'unread' as const },
			{ label: 'Reading', value: 'reading' as const },
			{ label: 'Finished', value: 'finished' as const },
		];

		filterButtons.forEach(({ label, value }) => {
			const button = filterContainer.createEl('button', {
				cls: this.currentFilter === value ? 'mod-cta' : '',
				text: label,
			});

			button.addEventListener('click', () => {
				this.currentFilter = value;
				this.render();
			});
		});

		// Sort dropdown
		const sortContainer = header.createEl('div', {
			cls: 'bookshelf-sort',
		});

		const sortSelect = sortContainer.createEl('select');
		
		const dateOption = sortSelect.createEl('option', { text: 'Date', value: 'date' });
		const titleOption = sortSelect.createEl('option', { text: 'Title', value: 'title' });
		const authorOption = sortSelect.createEl('option', { text: 'Author', value: 'author' });
		const progressOption = sortSelect.createEl('option', { text: 'Progress', value: 'progress' });
		
		sortSelect.value = this.currentSort;

		sortSelect.addEventListener('change', (e) => {
			this.currentSort = (e.target as HTMLSelectElement).value as typeof this.currentSort;
			this.render();
		});

		// Layout toggle
		const layoutContainer = header.createEl('div', {
			cls: 'bookshelf-layout-toggle',
		});

		const gridButton = layoutContainer.createEl('button', {
			cls: this.layout === 'grid' ? 'mod-cta' : '',
			text: 'Grid',
		});

		const listButton = layoutContainer.createEl('button', {
			cls: this.layout === 'list' ? 'mod-cta' : '',
			text: 'List',
		});

		gridButton.addEventListener('click', () => {
			this.layout = 'grid';
			this.render();
		});

		listButton.addEventListener('click', () => {
			this.layout = 'list';
			this.render();
		});

		// Books container
		const booksContainer = container.createEl('div', {
			cls: `bookshelf-books-container bookshelf-layout-${this.layout}`,
		});

		// Filter and sort books
		let filteredBooks = this.books;
		if (this.currentFilter !== 'all') {
			filteredBooks = filteredBooks.filter(
				({ book }) => book.status === this.currentFilter
			);
		}

		// Sort books
		filteredBooks.sort((a, b) => {
			switch (this.currentSort) {
				case 'title':
					return a.book.title.localeCompare(b.book.title);
				case 'author':
					const authorA = a.book.author[0] || '';
					const authorB = b.book.author[0] || '';
					return authorA.localeCompare(authorB);
				case 'progress':
					const progressA = a.book.totalPages && a.book.readPage
						? a.book.readPage / a.book.totalPages
						: 0;
					const progressB = b.book.totalPages && b.book.readPage
						? b.book.readPage / b.book.totalPages
						: 0;
					return progressB - progressA;
				case 'date':
				default:
					return new Date(b.book.created).getTime() - new Date(a.book.created).getTime();
			}
		});

		// Render books
		if (this.books.length === 0) {
			// Show empty state when no books are added
			this.renderEmptyState(booksContainer);
		} else if (filteredBooks.length === 0) {
			// Show no results for current filter
			booksContainer.createEl('div', {
				cls: 'bookshelf-empty',
				text: `No ${this.currentFilter === 'all' ? '' : this.currentFilter} books found.`,
			});
		} else {
			filteredBooks.forEach(({ book, file }) => {
				const bookCard = new BookCard(this.app, book, file, this.plugin);
				const cardElement = bookCard.render(this.layout);
				booksContainer.appendChild(cardElement);
			});
		}
	}

	/**
	 * Render empty state when no books are added
	 */
	private renderEmptyState(container: HTMLElement): void {
		const emptyState = container.createEl('div', {
			cls: 'bookshelf-empty-state',
		});

		emptyState.createEl('div', {
			cls: 'bookshelf-empty-icon',
			text: '??',
		});

		emptyState.createEl('h2', {
			cls: 'bookshelf-empty-title',
			text: 'No books added yet',
		});

		emptyState.createEl('p', {
			cls: 'bookshelf-empty-description',
			text: 'Start building your bookshelf by searching and adding books.',
		});

		const addButton = emptyState.createEl('button', {
			cls: 'mod-cta',
			text: 'Search and Add Book',
		});

		addButton.addEventListener('click', async () => {
			// Import and open search modal
			const { SearchModal } = await import('./searchModal');
			const modal = new SearchModal(this.app, this.plugin);
			modal.open();
		});
	}

	/**
	 * Refresh the view
	 */
	async refresh(): Promise<void> {
		await this.loadBooks();
		this.render();
	}
}
