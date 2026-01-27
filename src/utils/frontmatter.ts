import { App, TFile } from 'obsidian';
import { Book } from '../models/book';
import { ReadingRecord } from '../models/readingRecord';
import { getCurrentDateTime } from './dateUtils';

/**
 * Frontmatter utility functions
 */
export class FrontmatterProcessor {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Parse frontmatter from file content
	 * @param content File content
	 * @returns Parsed frontmatter object
	 */
	parseFrontmatter(content: string): Record<string, any> {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
		const match = content.match(frontmatterRegex);

		if (!match || !match[1]) {
			return {};
		}

		const frontmatterText = match[1];
		const frontmatter: Record<string, any> = {};

		// Simple YAML parser for basic key-value pairs
		const lines = frontmatterText.split('\n');
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}

			const colonIndex = trimmed.indexOf(':');
			if (colonIndex === -1) {
				continue;
			}

			const key = trimmed.substring(0, colonIndex).trim();
			let value: any = trimmed.substring(colonIndex + 1).trim();

			// Remove quotes if present
			if ((value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}

			// Parse arrays
			if (value.startsWith('[') && value.endsWith(']')) {
				const arrayContent = value.slice(1, -1).trim();
				if (arrayContent === '') {
					value = [];
				} else {
					value = arrayContent.split(',').map((item: string) => {
						const trimmedItem = item.trim();
						// Remove quotes
						if ((trimmedItem.startsWith('"') && trimmedItem.endsWith('"')) ||
							(trimmedItem.startsWith("'") && trimmedItem.endsWith("'"))) {
							return trimmedItem.slice(1, -1);
						}
						return trimmedItem;
					});
				}
			}

			// Parse numbers
			if (/^\d+$/.test(value)) {
				value = parseInt(value, 10);
			} else if (/^\d+\.\d+$/.test(value)) {
				value = parseFloat(value);
			}

			// Parse booleans
			if (value === 'true') {
				value = true;
			} else if (value === 'false') {
				value = false;
			}

			frontmatter[key] = value;
		}

		return frontmatter;
	}

	/**
	 * Extract frontmatter and body from file content
	 * @param content File content
	 * @returns Object with frontmatter and body
	 */
	extractFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			return { frontmatter: {}, body: content };
		}

		const frontmatter = this.parseFrontmatter(content);
		const body = content.substring(match[0].length);

		return { frontmatter, body };
	}

	/**
	 * Create frontmatter string from data
	 * @param data Frontmatter data
	 * @returns Frontmatter YAML string
	 */
	createFrontmatter(data: Record<string, any>): string {
		const lines: string[] = ['---'];

		for (const [key, value] of Object.entries(data)) {
			if (value === undefined || value === null) {
				continue;
			}

			if (Array.isArray(value)) {
				if (value.length === 0) {
					lines.push(`${key}: []`);
				} else {
					const formatted = value.map(item => {
						if (typeof item === 'string') {
							return `"${item}"`;
						}
						return String(item);
					}).join(', ');
					lines.push(`${key}: [${formatted}]`);
				}
			} else if (typeof value === 'string') {
				// Escape quotes in string values
				const escaped = value.replace(/"/g, '\\"');
				lines.push(`${key}: "${escaped}"`);
			} else if (typeof value === 'boolean' || typeof value === 'number') {
				lines.push(`${key}: ${value}`);
			} else {
				lines.push(`${key}: ${JSON.stringify(value)}`);
			}
		}

		lines.push('---');
		return lines.join('\n');
	}

	/**
	 * Update frontmatter in file content
	 * @param content Original file content
	 * @param updates Updates to apply to frontmatter
	 * @returns Updated file content
	 */
	updateFrontmatter(content: string, updates: Record<string, any>): string {
		const { frontmatter, body } = this.extractFrontmatter(content);
		const updatedFrontmatter = { ...frontmatter, ...updates };
		const frontmatterString = this.createFrontmatter(updatedFrontmatter);
		return `${frontmatterString}\n${body}`;
	}

	/**
	 * Convert Book to frontmatter data
	 * @param book Book object
	 * @returns Frontmatter data object
	 */
	bookToFrontmatter(book: Book): Record<string, any> {
		return {
			tag: '📚Book',
			title: book.title,
			subtitle: book.subtitle,
			author: book.author,
			category: book.category,
			publisher: book.publisher,
			publish: book.publishDate,
			total: book.totalPages,
			isbn: `${book.isbn10 || ''} ${book.isbn13 || ''}`.trim() || undefined,
			cover: book.coverUrl,
			localCover: book.localCover,
			status: book.status,
			created: book.created,
			updated: book.updated,
			read_started: book.readStarted,
			read_finished: book.readFinished,
			read_page: book.readPage || 0,
		};
	}

	/**
	 * Convert frontmatter data to Book
	 * @param frontmatter Frontmatter data
	 * @returns Book object
	 */
	frontmatterToBook(frontmatter: Record<string, any>): Partial<Book> {
		// Extract ISBN from isbn field (may contain both isbn10 and isbn13)
		let isbn10: string | undefined;
		let isbn13: string | undefined;
		if (frontmatter.isbn) {
			const isbns = String(frontmatter.isbn).trim().split(/\s+/);
			for (const isbn of isbns) {
				if (isbn.length === 10) {
					isbn10 = isbn;
				} else if (isbn.length === 13) {
					isbn13 = isbn;
				}
			}
		}

		return {
			title: frontmatter.title || '',
			subtitle: frontmatter.subtitle,
			author: Array.isArray(frontmatter.author) ? frontmatter.author : [],
			category: Array.isArray(frontmatter.category) ? frontmatter.category : [],
			publisher: frontmatter.publisher,
			publishDate: frontmatter.publish,
			totalPages: typeof frontmatter.total === 'number' ? frontmatter.total : undefined,
			isbn10,
			isbn13,
			coverUrl: frontmatter.cover,
			localCover: frontmatter.localCover,
			status: frontmatter.status || 'unread',
			readPage: typeof frontmatter.read_page === 'number' ? frontmatter.read_page : 0,
			readStarted: frontmatter.read_started,
			readFinished: frontmatter.read_finished,
			created: frontmatter.created || getCurrentDateTime(),
			updated: frontmatter.updated || getCurrentDateTime(),
		};
	}

	/**
	 * Update reading progress in frontmatter
	 * @param content File content
	 * @param page Current page number
	 * @param totalPages Total pages
	 * @param notes Optional notes
	 * @returns Updated file content
	 */
	updateReadingProgress(
		content: string,
		page: number,
		totalPages?: number,
		notes?: string
	): string {
		const { frontmatter, body } = this.extractFrontmatter(content);
		
		// Update read_page
		frontmatter.read_page = page;

		// Update status based on progress
		if (totalPages && page >= totalPages) {
			frontmatter.status = 'finished';
			if (!frontmatter.read_finished) {
				frontmatter.read_finished = getCurrentDateTime();
			}
		} else if (page > 0 && frontmatter.status === 'unread') {
			frontmatter.status = 'reading';
			if (!frontmatter.read_started) {
				frontmatter.read_started = getCurrentDateTime();
			}
		}

		// Update timestamp
		frontmatter.updated = getCurrentDateTime();

		// Add reading history entry if notes provided or if we want to track history
		if (notes || true) { // Always track history for now
			if (!frontmatter.reading_history) {
				frontmatter.reading_history = [];
			}

			const lastRecord = frontmatter.reading_history[frontmatter.reading_history.length - 1];
			const startPage = lastRecord?.end_page || frontmatter.read_page || 0;

			const newRecord: ReadingRecord = {
				date: getCurrentDateTime('YYYY-MM-DD'),
				startPage,
				endPage: page,
				pagesRead: page - startPage,
				notes,
				timestamp: getCurrentDateTime(),
			};

			frontmatter.reading_history.push(newRecord);
		}

		const frontmatterString = this.createFrontmatter(frontmatter);
		return `${frontmatterString}\n${body}`;
	}
}
