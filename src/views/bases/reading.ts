import { TFile } from 'obsidian';
import { Book } from '../../models/book';
import { BasesViewBase } from './base';
import { BookCard } from '../bookCard';
import BookshelfPlugin from '../../main';

/**
 * Reading View - Displays books currently being read
 */
export class ReadingBasesView extends BasesViewBase {
	type = "bookshelfReadingView";

	private books: Array<{ book: Book; file: TFile }> = [];

	async render(): Promise<void> {
		if (!this.rootElement || !this.data?.data) return;

		try {
			const dataItems = this.extractDataItems();
			const allBooks = await this.extractBooksFromBasesData(dataItems);
			
			// Filter only reading books
			this.books = allBooks.filter(({ book }) => book.status === 'reading');
			
			// Sort by progress or date
			this.books.sort((a, b) => {
				const progressA = a.book.totalPages && a.book.readPage
					? a.book.readPage / a.book.totalPages
					: 0;
				const progressB = b.book.totalPages && b.book.readPage
					? b.book.readPage / b.book.totalPages
					: 0;
				return progressB - progressA;
			});

			this.rootElement.empty();
			this.renderContent();
		} catch (error) {
			console.error('[Bookshelf][ReadingView] Render error:', error);
			this.renderError(error as Error);
		}
	}

	private renderContent(): void {
		if (!this.rootElement) return;

		const doc = this.rootElement.ownerDocument;

		// Header
		const header = doc.createElement('div');
		header.className = 'bookshelf-header';
		header.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--background-modifier-border);';

		const title = doc.createElement('h2');
		title.textContent = `Reading (${this.books.length})`;
		title.style.cssText = 'margin: 0; font-size: 1.2em;';
		header.appendChild(title);
		this.rootElement.appendChild(header);

		// Books container (always grid for reading books)
		const booksContainer = doc.createElement('div');
		booksContainer.className = 'bookshelf-books-container bookshelf-layout-grid';
		booksContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;';

		if (this.books.length === 0) {
			this.renderEmptyState(booksContainer);
		} else {
			this.books.forEach(({ book, file }) => {
				const bookCard = new BookCard(this.app, book, file, this.plugin);
				const cardElement = bookCard.render('grid'); // Always grid for reading books
				booksContainer.appendChild(cardElement);
			});
		}

		this.rootElement.appendChild(booksContainer);
	}

	private renderEmptyState(container: HTMLElement): void {
		const doc = container.ownerDocument;
		const emptyState = doc.createElement('div');
		emptyState.className = 'bookshelf-empty-state';
		emptyState.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center;';

		const icon = doc.createElement('div');
		icon.textContent = '📖';
		icon.style.cssText = 'font-size: 4em; margin-bottom: 16px;';
		emptyState.appendChild(icon);

		const title = doc.createElement('h2');
		title.textContent = 'No books being read';
		title.style.cssText = 'margin: 0 0 8px 0; font-size: 1.5em;';
		emptyState.appendChild(title);

		const description = doc.createElement('p');
		description.textContent = 'Start reading a book to see it here.';
		description.style.cssText = 'margin: 0 0 24px 0; color: var(--text-muted);';
		emptyState.appendChild(description);

		container.appendChild(emptyState);
	}
}

