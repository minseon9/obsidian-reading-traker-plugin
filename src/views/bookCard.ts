import { App, TFile } from 'obsidian';
import { Book } from '../models/book';
import { BookStatus } from '../models/bookStatus';
import BookshelfPlugin from '../main';
import { ProgressUpdateModal } from './progressUpdateModal';

/**
 * Book card component for rendering book items in Bookshelf View
 */
export class BookCard {
	private app: App;
	private book: Book;
	private file: TFile | null;
	private plugin: BookshelfPlugin | null;

	constructor(app: App, book: Book, file: TFile | null = null, plugin?: BookshelfPlugin) {
		this.app = app;
		this.book = book;
		this.file = file;
		this.plugin = plugin || null;
	}

	/**
	 * Render book card based on status
	 * @param layout Layout type ('grid' | 'list')
	 * @returns HTMLElement
	 */
	render(layout: 'grid' | 'list' = 'grid'): HTMLElement {
		if (this.book.status === 'reading') {
			return this.renderReadingBook(layout);
		} else {
			return this.renderShelfBook(layout);
		}
	}

	/**
	 * Render reading book with cover image (enhanced with more info)
	 */
	private renderReadingBook(layout: 'grid' | 'list'): HTMLElement {
		const card = document.createElement('div');
		card.className = `bookshelf-book-card bookshelf-book-reading bookshelf-layout-${layout}`;
		// Make card larger with more space for information
		card.style.cssText = 'min-height: 420px; display: flex; flex-direction: column;';

		// Cover image (larger)
		if (this.book.coverUrl) {
			const coverContainer = card.createEl('div', {
				cls: 'bookshelf-book-cover',
			});
			coverContainer.style.cssText = 'width: 100%; height: 240px; margin-bottom: 16px; flex-shrink: 0;';

			const coverImg = coverContainer.createEl('img', {
				attr: {
					src: this.book.coverUrl || '',
					alt: this.book.title || 'Book cover',
				},
			});
			coverImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);';

			coverImg.addEventListener('error', () => {
				coverImg.style.display = 'none';
			});
		}

		// Book info container (flexible, takes remaining space)
		const infoContainer = card.createEl('div', {
			cls: 'bookshelf-book-info',
		});
		infoContainer.style.cssText = 'padding: 0 12px 12px 12px; flex: 1; display: flex; flex-direction: column;';

		// Title
		infoContainer.createEl('div', {
			cls: 'bookshelf-book-title',
			text: this.book.title,
		}).style.cssText = 'font-size: 17px; font-weight: 600; margin-bottom: 8px; line-height: 1.4; color: var(--text-normal);';

		// Author
		if (this.book.author && this.book.author.length > 0) {
			infoContainer.createEl('div', {
				cls: 'bookshelf-book-author',
				text: this.book.author.join(', '),
			}).style.cssText = 'font-size: 13px; color: var(--text-muted); margin-bottom: 16px;';
		}

		// Get last read date from book data
		const lastReadDate = (this.book as any).lastReadDate;

		// Reading status and dates section (always show for reading books)
		const statusSection = infoContainer.createEl('div', {
			cls: 'bookshelf-reading-status',
		});
		statusSection.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 16px; padding: 12px; background-color: var(--background-secondary); border-radius: 6px; display: flex; flex-direction: column; gap: 8px;';

		// Started date (always show if available)
		if (this.book.readStarted) {
			const startedRow = statusSection.createEl('div');
			startedRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
			const startedLabel = startedRow.createEl('span', { text: 'Started:' });
			startedLabel.style.cssText = 'color: var(--text-faint); font-size: 11px;';
			const startedValue = startedRow.createEl('span', { text: this.book.readStarted.split(' ')[0] });
			startedValue.style.cssText = 'font-weight: 600; color: var(--text-normal); font-size: 12px;';
		} else {
			// Show placeholder if not started yet
			const startedRow = statusSection.createEl('div');
			startedRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
			const startedLabel = startedRow.createEl('span', { text: 'Started:' });
			startedLabel.style.cssText = 'color: var(--text-faint); font-size: 11px;';
			const startedValue = startedRow.createEl('span', { text: 'Not started' });
			startedValue.style.cssText = 'font-weight: 400; color: var(--text-muted); font-size: 12px; font-style: italic;';
		}

		// Last read date (always show if available)
		if (lastReadDate) {
			const lastReadRow = statusSection.createEl('div');
			lastReadRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
			const lastReadLabel = lastReadRow.createEl('span', { text: 'Last read:' });
			lastReadLabel.style.cssText = 'color: var(--text-faint); font-size: 11px;';
			const lastReadValue = lastReadRow.createEl('span', { text: lastReadDate });
			lastReadValue.style.cssText = 'font-weight: 700; color: var(--interactive-accent); font-size: 12px;';
		} else if (this.book.readStarted) {
			// Show "Not yet" if started but no reading history
			const lastReadRow = statusSection.createEl('div');
			lastReadRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
			const lastReadLabel = lastReadRow.createEl('span', { text: 'Last read:' });
			lastReadLabel.style.cssText = 'color: var(--text-faint); font-size: 11px;';
			const lastReadValue = lastReadRow.createEl('span', { text: 'Not yet' });
			lastReadValue.style.cssText = 'font-weight: 400; color: var(--text-muted); font-size: 12px; font-style: italic;';
		}

		// Progress section (enhanced) - always show if totalPages is available
		if (this.book.totalPages !== undefined && this.book.totalPages !== null && this.book.totalPages > 0) {
			const currentPage = this.book.readPage || 0;
			const progress = Math.min((currentPage / this.book.totalPages) * 100, 100);
			const remainingPages = Math.max(0, this.book.totalPages - currentPage);
			
			const progressContainer = infoContainer.createEl('div', {
				cls: 'bookshelf-progress-container',
			});
			progressContainer.style.cssText = 'margin-bottom: 16px;';

			// Progress text with more details
			const progressHeader = progressContainer.createEl('div');
			progressHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
			
			const progressLabel = progressHeader.createEl('div');
			progressLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-normal);';
			progressLabel.textContent = 'Progress';
			
			const progressPercent = progressHeader.createEl('div');
			progressPercent.style.cssText = 'font-size: 14px; font-weight: 700; color: var(--interactive-accent);';
			progressPercent.textContent = `${Math.round(progress)}%`;

			// Progress bar
			const progressBar = progressContainer.createEl('div', {
				cls: 'bookshelf-progress-bar',
			});
			progressBar.style.cssText = 'width: 100%; height: 10px; background-color: var(--background-modifier-border); border-radius: 5px; overflow: hidden; margin-bottom: 6px;';

			const progressFill = progressContainer.createEl('div', {
				cls: 'bookshelf-progress-fill',
			});
			progressFill.style.cssText = `width: ${progress}%; height: 100%; background-color: var(--interactive-accent); transition: width 0.3s; border-radius: 5px;`;

			progressBar.appendChild(progressFill);

			// Page details
			const pageDetails = progressContainer.createEl('div');
			pageDetails.style.cssText = 'display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);';
			
			const pagesRead = pageDetails.createEl('span');
			pagesRead.textContent = `Read: ${currentPage} pages`;
			
			const pagesRemaining = pageDetails.createEl('span');
			pagesRemaining.textContent = `Remaining: ${remainingPages} pages`;
		} else {
			// Show message when total pages is not set
			const noTotalContainer = infoContainer.createEl('div');
			noTotalContainer.style.cssText = 'padding: 12px; background: var(--background-secondary); border-radius: 6px; margin-bottom: 16px;';
			
			const noTotalText = noTotalContainer.createEl('div');
			noTotalText.style.cssText = 'font-size: 12px; color: var(--text-muted); text-align: center;';
			noTotalText.textContent = 'Please set total pages in frontmatter to track progress';
		}

		// Update progress button (for reading books)
		if (this.plugin && this.file) {
			const buttonContainer = infoContainer.createEl('div', {
				cls: 'bookshelf-card-actions',
			});
			buttonContainer.style.cssText = 'margin-top: auto; padding-top: 12px;';

			const updateButton = buttonContainer.createEl('button', {
				cls: 'mod-cta',
				text: 'Update Progress',
			});
			updateButton.style.cssText = 'width: 100%; padding: 10px; font-size: 13px; font-weight: 600;';

			updateButton.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent card click
				const modal = new ProgressUpdateModal(this.app, this.plugin!, this.file!);
				modal.open();
			});
		}

		// Click handler (for opening note)
		if (this.file) {
			card.addEventListener('click', (e) => {
				// Don't open if clicking on button
				if ((e.target as HTMLElement).closest('button')) {
					return;
				}
				this.app.workspace.openLinkText(this.file!.path, '', false);
			});
			card.style.cursor = 'pointer';
		}

		return card;
	}

	/**
	 * Render shelf book (unread/finished) with spine style
	 */
	private renderShelfBook(layout: 'grid' | 'list'): HTMLElement {
		const card = document.createElement('div');
		card.className = `bookshelf-book-card bookshelf-book-shelf bookshelf-status-${this.book.status} bookshelf-layout-${layout}`;

		// Spine container
		const spineContainer = card.createEl('div', {
			cls: 'bookshelf-book-spine',
		});

		// Title on spine
		spineContainer.createEl('div', {
			cls: 'bookshelf-spine-title',
			text: this.book.title,
		});

		// Author on spine
		if (this.book.author && this.book.author.length > 0) {
			spineContainer.createEl('div', {
				cls: 'bookshelf-spine-author',
				text: this.book.author.join(', '),
			});
		}

		// Status badge
		const statusBadge = spineContainer.createEl('div', {
			cls: 'bookshelf-status-badge',
			text: this.book.status === 'finished' ? 'Finished' : 'Unread',
		});

		// Finished date
		if (this.book.status === 'finished' && this.book.readFinished) {
			spineContainer.createEl('div', {
				cls: 'bookshelf-spine-meta',
				text: `Finished: ${this.book.readFinished.split(' ')[0]}`,
			});
		}

		// Click handler
		if (this.file) {
			card.addEventListener('click', () => {
				this.app.workspace.openLinkText(this.file!.path, '', false);
			});
			card.style.cursor = 'pointer';
		}

		return card;
	}
}
