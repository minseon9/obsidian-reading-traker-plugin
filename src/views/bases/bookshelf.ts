/* eslint-disable obsidianmd/no-static-styles-assignment */
import { TFile } from 'obsidian';
import { Book } from '../../models/book';
import { BookStatus } from '../../models/bookStatus';
import { BasesViewBase } from './base';
import { BookCard } from '../bookCard';
import { BookFileReader } from '../../services/bookFileService/bookFileReader';
import { BookFileUpdater } from '../../services/bookFileService/bookFileUpdater';

/**
 * Build factory function for Bookshelf View
 */
export class BookshelfBasesView extends BasesViewBase {
	type = "bookshelfView";

	private books: Array<{ book: Book; file: TFile }> = [];

	/**
	 * Component lifecycle: Called when view is first loaded.
	 */
	onload(): void {
		super.onload();
	}

	/**
	 * Render the view
	 */
	async render(): Promise<void> {
		if (!this.rootElement) {
			return;
		}

		if (!this.data?.data) {
			return;
		}

		try {
			
			// Extract data using adapter
			const dataItems = this.extractDataItems();

			// Extract books from Bases data
			this.books = await this.extractBooksFromBasesData(dataItems);

			// Clear and render
			this.rootElement.empty();
			this.renderContent();
		} catch (error) {
			console.error('[Bookshelf][BasesView] Render error:', error);
			this.renderError(error as Error);
		}
	}

	/**
	 * Render the main content
	 * Main: Reading books, Sub: Unread books (simple list)
	 */
	private renderContent(): void {
		if (!this.rootElement) return;


		const doc = this.rootElement.ownerDocument;

		// No header needed - layout is fixed

		// Main content container
		const contentContainer = doc.createElement('div');
		contentContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px;';

		// Filter books
		const readingBooks = this.books.filter(({ book }) => book.status === 'reading');
		const unreadBooks = this.books.filter(({ book }) => book.status === 'unread');

		// Sort
		readingBooks.sort((a, b) => this.sortBooks(a.book, b.book));
		unreadBooks.sort((a, b) => this.sortBooks(a.book, b.book));

		// Always show reading section (even if empty) and unread section
		// Main section: Reading books (always shown)
		if (readingBooks.length > 0) {
			this.renderReadingSection(contentContainer, readingBooks);
		} else {
			this.renderEmptyReadingSection(contentContainer);
		}

		// Sub section: Unread books (always shown, simple list, collapsible)
		if (unreadBooks.length > 0) {
			this.renderUnreadSubSection(contentContainer, unreadBooks);
		} else {
			// Show empty unread section if no unread books
			this.renderEmptyUnreadSection(contentContainer);
		}

		// Only show empty state if both sections are empty
		if (readingBooks.length === 0 && unreadBooks.length === 0) {
			contentContainer.empty();
			this.renderEmptyState(contentContainer);
		}

		this.rootElement.appendChild(contentContainer);
	}

	/**
	 * Render reading section (main)
	 */
	private renderReadingSection(
		container: HTMLElement,
		books: Array<{ book: Book; file: TFile }>
	): void {
		const doc = container.ownerDocument;

		// Section header
		const sectionHeader = doc.createElement('div');
		sectionHeader.className = 'bookshelf-section-header';
		sectionHeader.style.cssText = 'margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--background-modifier-border);';
		
		const titleEl = doc.createElement('h2');
		titleEl.textContent = `Reading (${books.length})`;
		titleEl.style.cssText = 'margin: 0; font-size: 1.5em; font-weight: 600;';
		sectionHeader.appendChild(titleEl);
		container.appendChild(sectionHeader);

		// Books grid with drop zone (always grid for reading books)
		// Larger cards need more space
		const booksGrid = doc.createElement('div');
		booksGrid.className = 'bookshelf-section-books bookshelf-layout-grid bookshelf-drop-zone';
		booksGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; min-height: 100px;';

		// Drop handlers for reading section
		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}
			booksGrid.classList.add('drag-over');
		};

		const handleDragEnter = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			booksGrid.classList.add('drag-over');
		};

		const handleDragLeave = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			// Only remove class if actually leaving the element
			const rect = booksGrid.getBoundingClientRect();
			const x = e.clientX;
			const y = e.clientY;
			if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
				booksGrid.classList.remove('drag-over');
			}
		};

		booksGrid.addEventListener('dragover', handleDragOver, false);
		booksGrid.addEventListener('dragenter', handleDragEnter, false);
		booksGrid.addEventListener('dragleave', handleDragLeave, false);

		const handleDrop = async (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			booksGrid.classList.remove('drag-over');

			try {
				// Try to get book data - must be synchronous
				let filePath: string | null = null;
				
			// First try application/bookshelf-book
			try {
				const bookData = e.dataTransfer?.getData('application/bookshelf-book');
				if (bookData && bookData.trim()) {
					const parsed = JSON.parse(bookData);
					filePath = parsed.path;
				}
			} catch {
				// Ignore parse errors
			}
			
			// Fallback to text/plain
			if (!filePath) {
				try {
					const textData = e.dataTransfer?.getData('text/plain');
					if (textData && textData.trim()) {
						filePath = textData.trim();
					}
				} catch {
					// Ignore errors
				}
			}

				if (filePath) {
					await this.handleBookStatusChange(filePath, 'reading');
				} else {
					console.warn('[Bookshelf] No file path found in drop data. Available types:', Array.from(e.dataTransfer?.types || []));
				}
			} catch (error) {
				console.error('[Bookshelf] Error handling drop:', error);
			}
		};

		booksGrid.addEventListener('drop', (e) => void handleDrop(e), false);

		books.forEach(({ book, file }) => {
			const app = this.app || this.plugin.app;
			const bookCard = new BookCard(app, book, file, this.plugin);
			const cardElement = bookCard.render('grid'); // Always grid for reading books
			booksGrid.appendChild(cardElement);
		});

		container.appendChild(booksGrid);
	}

	/**
	 * Handle book status change via drag and drop
	 */
	private async handleBookStatusChange(filePath: string, newStatus: BookStatus): Promise<void> {
		
		try {
			const app = this.app || this.plugin.app;
			if (!app) {
				return;
			}
			
			const file = app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				return;
			}

			const bookFileReader = new BookFileReader(app);
			const bookFileUpdater = new BookFileUpdater(app);
			const updates: Partial<Book> = { status: newStatus };

			if (newStatus === 'reading') {
				const bookData = await bookFileReader.read(file);
				if (!bookData.readStarted) {
					const { getCurrentDateTime } = await import('../../utils/dateUtils');
					updates.readStarted = getCurrentDateTime();
				}
			}

			await bookFileUpdater.updateBook(file, updates);

		// Refresh the view
		setTimeout(() => {
			void this.render();
		}, 300);
		} catch (error) {
			console.error('[Bookshelf] Error changing book status:', error);
		}
	}

	/**
	 * Render empty reading section (with drop zone)
	 */
	private renderEmptyReadingSection(container: HTMLElement): void {
		const doc = container.ownerDocument;
		
		// Section header
		const sectionHeader = doc.createElement('div');
		sectionHeader.className = 'bookshelf-section-header';
		sectionHeader.style.cssText = 'margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--background-modifier-border);';
		
		const titleEl = doc.createElement('h2');
		titleEl.textContent = 'Reading (0)';
		titleEl.style.cssText = 'margin: 0; font-size: 1.5em; font-weight: 600;';
		sectionHeader.appendChild(titleEl);
		container.appendChild(sectionHeader);

		// Empty drop zone (can still accept drops)
		const dropZone = doc.createElement('div');
		dropZone.className = 'bookshelf-section-books bookshelf-layout-grid bookshelf-drop-zone';
		dropZone.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 40px; min-height: 200px; border: 2px dashed var(--background-modifier-border); border-radius: 8px; text-align: center; color: var(--text-muted); transition: all 0.2s;';

	const description = doc.createElement('p');
	description.textContent = 'Drag a book from "to read" section here to start reading';
	description.style.cssText = 'margin: 0; font-size: 14px; font-weight: 500;';
	dropZone.appendChild(description);

	const hint = doc.createElement('p');
	hint.textContent = 'Or click "new book" to add a new book';
		hint.style.cssText = 'margin: 8px 0 0 0; font-size: 12px; color: var(--text-faint);';
		dropZone.appendChild(hint);

		// Add drop handlers to empty zone
		dropZone.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}
			dropZone.classList.add('drag-over');
			dropZone.style.borderColor = 'var(--interactive-accent)';
			dropZone.style.backgroundColor = 'var(--background-modifier-hover)';
		});

		dropZone.addEventListener('dragenter', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropZone.classList.add('drag-over');
			dropZone.style.borderColor = 'var(--interactive-accent)';
			dropZone.style.backgroundColor = 'var(--background-modifier-hover)';
		});

		dropZone.addEventListener('dragleave', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const rect = dropZone.getBoundingClientRect();
			const x = e.clientX;
			const y = e.clientY;
			if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
				dropZone.classList.remove('drag-over');
				dropZone.style.borderColor = 'var(--background-modifier-border)';
				dropZone.style.backgroundColor = '';
			}
		});

		dropZone.addEventListener('drop', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			dropZone.classList.remove('drag-over');
			dropZone.style.borderColor = 'var(--background-modifier-border)';
			dropZone.style.backgroundColor = '';


			try {
				let filePath: string | null = null;
				
				const bookData = e.dataTransfer?.getData('application/bookshelf-book');
			if (bookData) {
				try {
					const parsed = JSON.parse(bookData);
					filePath = parsed.path;
				} catch {
					// Ignore parse errors
				}
			}
				
				if (!filePath) {
					const textData = e.dataTransfer?.getData('text/plain');
					if (textData) {
						filePath = textData;
					}
				}

				if (filePath) {
					await this.handleBookStatusChange(filePath, 'reading');
				} else {
					console.warn('[Bookshelf] No file path found in drop data');
				}
			} catch (error) {
				console.error('[Bookshelf] Error handling drop:', error);
			}
		});

		container.appendChild(dropZone);
	}

	/**
	 * Render empty unread section
	 */
	private renderEmptyUnreadSection(container: HTMLElement): void {
		const doc = container.ownerDocument;
		
		const section = doc.createElement('div');
		section.className = 'bookshelf-unread-subsection';
		section.style.cssText = 'margin-top: 32px;';

		// Collapsible header
		const header = doc.createElement('div');
		header.className = 'bookshelf-subsection-header';
		header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--background-modifier-border);';
		
		const titleEl = doc.createElement('h3');
		titleEl.textContent = 'To Read (0)';
		titleEl.style.cssText = 'margin: 0; font-size: 1.1em; font-weight: 500; color: var(--text-muted);';
		header.appendChild(titleEl);

		section.appendChild(header);

		const content = doc.createElement('div');
		content.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted);';
		content.textContent = 'No unread books.';
		section.appendChild(content);

		container.appendChild(section);
	}

	/**
	 * Render unread sub-section (simple list, collapsible)
	 */
	private renderUnreadSubSection(
		container: HTMLElement,
		books: Array<{ book: Book; file: TFile }>
	): void {
		const doc = container.ownerDocument;

		// Collapsible section
		const section = doc.createElement('div');
		section.className = 'bookshelf-unread-subsection';
		section.style.cssText = 'margin-top: 32px;';

		// Collapsible header
		const header = doc.createElement('div');
		header.className = 'bookshelf-subsection-header';
		header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 0; cursor: pointer; border-bottom: 1px solid var(--background-modifier-border);';
		
		const titleEl = doc.createElement('h3');
		titleEl.textContent = `To Read (${books.length})`;
		titleEl.style.cssText = 'margin: 0; font-size: 1.1em; font-weight: 500; color: var(--text-muted);';
		header.appendChild(titleEl);

		const chevron = doc.createElement('span');
		chevron.textContent = '?';
		chevron.style.cssText = 'font-size: 10px; color: var(--text-muted); transition: transform 0.2s;';
		header.appendChild(chevron);

		// Collapsible content
		const content = doc.createElement('div');
		content.className = 'bookshelf-unread-list';
		content.style.cssText = 'max-height: 300px; overflow-y: auto; margin-top: 8px;';
		
		let isExpanded = true;
		const toggleExpand = () => {
			isExpanded = !isExpanded;
			content.style.display = isExpanded ? 'block' : 'none';
			chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
		};

		header.addEventListener('click', toggleExpand);

		// Simple list of unread books
		const list = doc.createElement('ul');
		list.style.cssText = 'list-style: none; padding: 0; margin: 0;';

		books.forEach(({ book, file }) => {
			const listItem = doc.createElement('li');
			listItem.className = 'bookshelf-unread-item';
			listItem.draggable = true;
			listItem.dataset.bookPath = file.path;
			listItem.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid var(--background-modifier-border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
			listItem.addEventListener('click', (e) => {
				// Only open if not dragging
				if (e.defaultPrevented) return;
				const app = this.app || this.plugin.app;
				if (app) {
					app.workspace.openLinkText(file.path, '', true);
				}
			});

			// Drag handlers
			let isDragging = false;
			
			const handleDragStart = (e: DragEvent) => {
				isDragging = true;
				listItem.classList.add('dragging');
				
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move';
					// Set both formats for compatibility - order matters!
					// text/plain first (more compatible)
					e.dataTransfer.setData('text/plain', file.path);
					// Then custom format
					e.dataTransfer.setData('application/bookshelf-book', JSON.stringify({ path: file.path, status: 'unread' }));
				} else {
					console.error('[Bookshelf] dataTransfer is null in dragstart');
				}
			};

			listItem.addEventListener('dragstart', handleDragStart, false);

			listItem.addEventListener('dragend', (e) => {
				isDragging = false;
				listItem.classList.remove('dragging');
				// Clear any drop zone styles
				const dropZones = doc.querySelectorAll('.bookshelf-drop-zone');
				dropZones.forEach((zone: Element) => {
					zone.classList.remove('drag-over');
				});
			});

			// Prevent click during drag
			listItem.addEventListener('click', (e) => {
				if (isDragging) {
					e.preventDefault();
					e.stopPropagation();
					setTimeout(() => {
						isDragging = false;
					}, 100);
					return;
				}
			});

			// Title and author
			const info = doc.createElement('div');
			info.style.cssText = 'flex: 1;';

			const title = doc.createElement('div');
			title.textContent = book.title;
			title.style.cssText = 'font-weight: 500; font-size: 13px; margin-bottom: 2px;';
			info.appendChild(title);

			if (book.author && book.author.length > 0) {
				const author = doc.createElement('div');
				author.textContent = book.author.join(', ');
				author.style.cssText = 'font-size: 11px; color: var(--text-muted);';
				info.appendChild(author);
			}

			listItem.appendChild(info);

			// Drag indicator
			const dragIcon = doc.createElement('span');
			dragIcon.textContent = '';
			dragIcon.style.cssText = 'color: var(--text-faint); font-size: 12px; margin-left: 8px; cursor: grab; user-select: none;';
			dragIcon.title = 'Drag to Reading section to start reading';
			// Make drag icon also draggable
			dragIcon.addEventListener('mousedown', (e) => {
				e.stopPropagation();
			});
			listItem.appendChild(dragIcon);

			list.appendChild(listItem);
		});

		content.appendChild(list);
		section.appendChild(header);
		section.appendChild(content);
		container.appendChild(section);
	}

	/**
	 * Sort books by default sort setting
	 */
	private sortBooks(a: Book, b: Book): number {
		const sortType = this.plugin.settings.defaultSort || 'date';

		switch (sortType) {
			case 'title':
				return a.title.localeCompare(b.title);
			case 'author':
				const authorA = a.author[0] || '';
				const authorB = b.author[0] || '';
				return authorA.localeCompare(authorB);
			case 'progress':
				const progressA = a.totalPages && a.readPage
					? a.readPage / a.totalPages
					: 0;
				const progressB = b.totalPages && b.readPage
					? b.readPage / b.totalPages
					: 0;
				return progressB - progressA;
			case 'date':
			default:
				return new Date(b.created).getTime() - new Date(a.created).getTime();
		}
	}

	/**
	 * Render empty state when no books are added
	 */
	private renderEmptyState(container: HTMLElement): void {
		const doc = container.ownerDocument;
		const emptyState = doc.createElement('div');
		emptyState.className = 'bookshelf-empty-state';
		emptyState.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center;';

		const title = doc.createElement('h2');
		title.className = 'bookshelf-empty-title';
		title.textContent = 'No books added yet';
		title.style.cssText = 'margin: 0 0 8px 0; font-size: 1.5em;';
		emptyState.appendChild(title);

		const description = doc.createElement('p');
		description.className = 'bookshelf-empty-description';
		description.textContent = 'Start building your bookshelf by searching and adding books.';
		description.style.cssText = 'margin: 0 0 24px 0; color: var(--text-muted);';
		emptyState.appendChild(description);

		const addButton = doc.createElement('button');
		addButton.className = 'mod-cta';
		addButton.textContent = 'Search and Add Book';
		addButton.addEventListener('click', async (e) => {
			e.stopPropagation();
			e.preventDefault();
			const app = this.app || this.plugin.app;
			if (!app) {
				console.error("[Bookshelf] App not available");
				return;
			}
			try {
				const { SearchModal } = await import('../bookSearchModal');
				const modal = new SearchModal(app, this.plugin);
				modal.open();
			} catch (error) {
				console.error("[Bookshelf] Error opening search modal:", error);
			}
		});
		emptyState.appendChild(addButton);

		container.appendChild(emptyState);
	}
}
