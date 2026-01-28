import { TFile } from 'obsidian';
import { Book } from '../../models/book';
import { BasesViewBase } from './base';
import BookshelfPlugin from '../../main';

/**
 * Library View - Displays unread and finished books in list format
 */
export class LibraryBasesView extends BasesViewBase {
	type = "bookshelfLibraryView";

	private unreadBooks: Array<{ book: Book; file: TFile }> = [];
	private finishedBooks: Array<{ book: Book; file: TFile }> = [];

	constructor(controller: any, containerEl: HTMLElement, plugin: BookshelfPlugin) {
		super(controller, containerEl, plugin);
	}

	async render(): Promise<void> {
		if (!this.rootElement || !this.data?.data) return;

		try {
			const dataItems = this.extractDataItems();
			const allBooks = await this.extractBooksFromBasesData(dataItems);
			
			// Filter books
			this.unreadBooks = allBooks.filter(({ book }) => book.status === 'unread');
			this.finishedBooks = allBooks.filter(({ book }) => book.status === 'finished');
			
			// Sort unread by date (newest first)
			this.unreadBooks.sort((a, b) => {
				return new Date(b.book.created).getTime() - new Date(a.book.created).getTime();
			});

			// Sort finished by finished date (newest first)
			this.finishedBooks.sort((a, b) => {
				const dateA = a.book.readFinished ? new Date(a.book.readFinished).getTime() : 0;
				const dateB = b.book.readFinished ? new Date(b.book.readFinished).getTime() : 0;
				return dateB - dateA;
			});

			this.rootElement.empty();
			this.renderContent();
		} catch (error) {
			console.error('[Bookshelf][UnreadFinishedView] Render error:', error);
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
		title.textContent = `Unread & Finished (${this.unreadBooks.length} unread, ${this.finishedBooks.length} finished)`;
		title.style.cssText = 'margin: 0; font-size: 1.2em;';
		header.appendChild(title);

		this.rootElement.appendChild(header);

		// Content container
		const contentContainer = doc.createElement('div');
		contentContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px;';

		// Render Unread section
		if (this.unreadBooks.length > 0) {
			this.renderSection(contentContainer, doc, 'Unread Books', this.unreadBooks, 'unread');
		} else {
			// Create section container for empty state
			const unreadSectionContainer = doc.createElement('div');
			unreadSectionContainer.style.cssText = 'margin-top: 24px;';
			
			// Section header
			const sectionHeader = doc.createElement('div');
			sectionHeader.style.cssText = 'margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--background-modifier-border);';
			
			const titleEl = doc.createElement('h3');
			titleEl.textContent = 'Unread Books (0)';
			titleEl.style.cssText = 'margin: 0; font-size: 1.2em; font-weight: 600;';
			sectionHeader.appendChild(titleEl);
			unreadSectionContainer.appendChild(sectionHeader);
			
			// Empty state inside section
			this.renderEmptyState(unreadSectionContainer);
			contentContainer.appendChild(unreadSectionContainer);
		}

		// Render Finished section
		if (this.finishedBooks.length > 0) {
			this.renderSection(contentContainer, doc, 'Finished Books', this.finishedBooks, 'finished');
		} else {
			// Create section container for empty state
			const finishedSectionContainer = doc.createElement('div');
			finishedSectionContainer.style.cssText = 'margin-top: 24px;';
			
			// Section header
			const sectionHeader = doc.createElement('div');
			sectionHeader.style.cssText = 'margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--background-modifier-border);';
			
			const titleEl = doc.createElement('h3');
			titleEl.textContent = 'Finished Books (0)';
			titleEl.style.cssText = 'margin: 0; font-size: 1.2em; font-weight: 600;';
			sectionHeader.appendChild(titleEl);
			finishedSectionContainer.appendChild(sectionHeader);
			
			// Empty state inside section
			this.renderEmptyState(finishedSectionContainer);
			contentContainer.appendChild(finishedSectionContainer);
		}

		this.rootElement.appendChild(contentContainer);
	}

	private renderSection(
		container: HTMLElement,
		doc: Document,
		title: string,
		books: Array<{ book: Book; file: TFile }>,
		type: 'unread' | 'finished'
	): void {
		// Section header
		const sectionHeader = doc.createElement('div');
		sectionHeader.style.cssText = 'margin-top: 24px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--background-modifier-border);';
		
		const titleEl = doc.createElement('h3');
		titleEl.textContent = `${title} (${books.length})`;
		titleEl.style.cssText = 'margin: 0; font-size: 1.2em; font-weight: 600;';
		sectionHeader.appendChild(titleEl);
		container.appendChild(sectionHeader);

		// Books list
		const list = doc.createElement('ul');
		list.style.cssText = 'list-style: none; padding: 0; margin: 0;';

		books.forEach(({ book, file }) => {
			const listItem = doc.createElement('li');
			listItem.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--background-modifier-border); cursor: pointer;';
			listItem.addEventListener('click', (e) => {
				// Only open if not prevented
				if (e.defaultPrevented) return;
				const app = this.app || this.plugin.app;
				if (app) {
					app.workspace.openLinkText(file.path, '', true);
				}
			});

			// Title
			const titleEl = doc.createElement('div');
			titleEl.textContent = book.title;
			titleEl.style.cssText = 'font-weight: 600; font-size: 14px; margin-bottom: 4px;';
			listItem.appendChild(titleEl);

			// Author
			if (book.author && book.author.length > 0) {
				const authorEl = doc.createElement('div');
				authorEl.textContent = book.author.join(', ');
				authorEl.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 4px;';
				listItem.appendChild(authorEl);
			}

			// Meta info
			const metaEl = doc.createElement('div');
			metaEl.style.cssText = 'font-size: 11px; color: var(--text-faint); display: flex; gap: 12px;';
			
			if (type === 'finished' && book.readFinished) {
				const finishedEl = doc.createElement('span');
				finishedEl.textContent = `Finished: ${book.readFinished}`;
				metaEl.appendChild(finishedEl);
			} else if (type === 'unread' && book.created) {
				const createdEl = doc.createElement('span');
				createdEl.textContent = `Added: ${book.created.split(' ')[0]}`;
				metaEl.appendChild(createdEl);
			}
			
			if (book.totalPages) {
				const pagesEl = doc.createElement('span');
				pagesEl.textContent = `${book.totalPages} pages`;
				metaEl.appendChild(pagesEl);
			}

			listItem.appendChild(metaEl);
			list.appendChild(listItem);
		});

		container.appendChild(list);
	}


	private renderEmptyState(container: HTMLElement): void {
		const doc = container.ownerDocument;
		const emptyState = doc.createElement('div');
		emptyState.className = 'bookshelf-empty-state';
		emptyState.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center;';

		const icon = doc.createElement('div');
		icon.className = 'bookshelf-empty-icon';
		icon.textContent = '📚';
		icon.style.cssText = 'font-size: 3em; margin-bottom: 12px;';
		emptyState.appendChild(icon);

		const title = doc.createElement('div');
		title.textContent = 'No books';
		title.style.cssText = 'margin: 0; font-size: 1.1em; color: var(--text-muted);';
		emptyState.appendChild(title);

		container.appendChild(emptyState);
	}
}

