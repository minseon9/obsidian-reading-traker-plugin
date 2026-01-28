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
			
			// reading_history is now stored in body, not frontmatter (legacy support)
			// reading_history_summary is stored in frontmatter for statistics
			if (key === 'reading_history') {
				continue; // Skip old reading_history in frontmatter
			}
			
			// Handle reading_history_summary - ensure it's always an array
			if (key === 'reading_history_summary') {
				// If it's an empty string or invalid format, convert to empty array
				if (value === '' || value === null || (typeof value === 'string' && value.trim() === '')) {
					frontmatter[key] = [];
					continue;
				}
				// If it's already an array, keep it
				if (Array.isArray(value)) {
					frontmatter[key] = value;
					continue;
				}
				// Otherwise, try to parse as array
				if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
					try {
						frontmatter[key] = JSON.parse(value);
						continue;
					} catch (e) {
						// If parsing fails, use empty array
						frontmatter[key] = [];
						continue;
					}
				}
				// Default to empty array if we can't parse it
				frontmatter[key] = [];
				continue;
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
					// Only include empty arrays for reading_history_summary (for initialization)
					if (key === 'reading_history_summary') {
						lines.push(`${key}: []`);
					}
					// Skip other empty arrays
					continue;
				} else {
					// Handle reading_history_summary (array of objects for statistics)
					if (key === 'reading_history_summary' && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])) {
						// Ensure we have a proper array of objects
						const validItems = value.filter((item: any) => item && typeof item === 'object' && !Array.isArray(item));
						if (validItems.length > 0) {
							lines.push(`${key}:`);
							for (const item of validItems) {
								lines.push(`  - date: "${item.date || ''}"`);
								lines.push(`    startPage: ${item.startPage ?? 0}`);
								lines.push(`    endPage: ${item.endPage ?? 0}`);
								lines.push(`    pagesRead: ${item.pagesRead ?? 0}`);
								if (item.timestamp) {
									lines.push(`    timestamp: "${item.timestamp}"`);
								}
							}
						} else {
							// If no valid items, use empty array
							lines.push(`${key}: []`);
						}
					} else if (key === 'reading_history') {
						// Skip old reading_history - it's stored in body now
						continue;
					} else if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])) {
						// Format as YAML array of objects (for other object arrays)
						lines.push(`${key}:`);
						for (const item of value) {
							lines.push(`  - ${JSON.stringify(item)}`);
						}
					} else {
						// Regular array
						const formatted = value.map(item => {
							if (typeof item === 'string') {
								return `"${item}"`;
							}
							return String(item);
						}).join(', ');
						lines.push(`${key}: [${formatted}]`);
					}
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
		const frontmatter: Record<string, any> = {
			title: book.title,
			subtitle: book.subtitle,
			author: book.author,
			category: book.category,
			publisher: book.publisher,
			publish: book.publishDate,
			cover: book.coverUrl,
			status: book.status,
			created: book.created,
			updated: book.updated,
			read_started: book.readStarted,
			read_finished: book.readFinished,
			read_page: book.readPage || 0,
		};

		// Only include total if it's a valid number
		if (book.totalPages !== undefined && book.totalPages !== null && !isNaN(book.totalPages)) {
			frontmatter.total = book.totalPages;
		}

		// Only include isbn if it exists
		const isbn = `${book.isbn10 || ''} ${book.isbn13 || ''}`.trim();
		if (isbn) {
			frontmatter.isbn = isbn;
		}

		return frontmatter;
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

		// Calculate total pages read from reading_history_summary if available
		let calculatedReadPage = typeof frontmatter.read_page === 'number' ? frontmatter.read_page : 0;
		if (frontmatter.reading_history_summary && Array.isArray(frontmatter.reading_history_summary)) {
			const totalFromHistory = frontmatter.reading_history_summary.reduce((sum: number, record: any) => {
				return sum + (record.pagesRead || 0);
			}, 0);
			// Use the higher value (either from read_page or calculated from history)
			if (totalFromHistory > calculatedReadPage) {
				calculatedReadPage = totalFromHistory;
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
			status: frontmatter.status || 'unread',
			readPage: calculatedReadPage,
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
		notes?: string,
		autoStatusChange: boolean = true,
		startPage?: number
	): string {
		const { frontmatter, body } = this.extractFrontmatter(content);
		
		// Update read_page
		frontmatter.read_page = page;

		// Update status based on progress (if autoStatusChange is enabled)
		if (autoStatusChange) {
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
		}

		// Update timestamp
		frontmatter.updated = getCurrentDateTime();

		// Add reading history entry to both frontmatter (summary) and body (detailed)
		// Frontmatter summary is for statistics, body contains full details
		const shouldTrackHistory = true; // Will be controlled by settings in the future
		if (shouldTrackHistory) {
			// Parse existing reading history from body
			const existingHistory = this.parseReadingHistoryFromBody(body);
			
			// Use provided startPage if available, otherwise get from last record
			let recordStartPage: number;
			if (startPage !== undefined) {
				recordStartPage = startPage;
			} else {
				const lastRecord = existingHistory.length > 0 
					? existingHistory[existingHistory.length - 1] 
					: null;
				recordStartPage = lastRecord?.endPage || frontmatter.read_page || 0;
			}

			// Create new record with proper structure
			const newRecord: ReadingRecord = {
				date: getCurrentDateTime('YYYY-MM-DD'),
				startPage: recordStartPage,
				endPage: page,
				pagesRead: Math.max(0, page - recordStartPage),
				notes: notes || undefined,
				timestamp: getCurrentDateTime(),
			};

			// Add new record to history
			existingHistory.push(newRecord);

			// Update frontmatter with summary (for statistics - no notes)
			if (!frontmatter.reading_history_summary || !Array.isArray(frontmatter.reading_history_summary)) {
				frontmatter.reading_history_summary = [];
			}
			
			// Add summary entry (without notes for frontmatter)
			frontmatter.reading_history_summary.push({
				date: newRecord.date,
				startPage: newRecord.startPage,
				endPage: newRecord.endPage,
				pagesRead: newRecord.pagesRead,
				timestamp: newRecord.timestamp,
			});

			// Update body with reading history section (full details with notes)
			const updatedBody = this.updateReadingHistoryInBody(body, existingHistory);
			
			const frontmatterString = this.createFrontmatter(frontmatter);
			return `${frontmatterString}\n${updatedBody}`;
		}

		const frontmatterString = this.createFrontmatter(frontmatter);
		return `${frontmatterString}\n${body}`;
	}

	/**
	 * Parse reading history from body content
	 * Looks for a "## Reading History" section
	 */
	parseReadingHistoryFromBody(body: string): ReadingRecord[] {
		const history: ReadingRecord[] = [];
		
		// Look for Reading History section
		const historySectionRegex = /^##\s+Reading History\s*\n([\s\S]*?)(?=\n##|\n#|$)/m;
		const match = body.match(historySectionRegex);
		
		if (!match || !match[1]) {
			return history;
		}

		const historyContent = match[1];
		// Parse each record (format: ### YYYY-MM-DD or - **Date:** YYYY-MM-DD)
		const recordRegex = /(?:^###\s+(\d{4}-\d{2}-\d{2})|^-\s+\*\*Date:\*\*\s+(\d{4}-\d{2}-\d{2}))\s*\n([\s\S]*?)(?=\n(?:###|-\s+\*\*Date:)|$)/gm;
		let recordMatch;
		
		while ((recordMatch = recordRegex.exec(historyContent)) !== null) {
			const date = recordMatch[1] || recordMatch[2] || '';
			const recordText = recordMatch[3] || '';
			
			// Extract fields from record text
			// Support formats like: "**Start Page:** 0" or "Start: 0" or "From: 0"
			const startPageMatch = recordText.match(/(?:\*\*Start Page:\*\*|Start Page:|Start:|From:)\s*(\d+)/i);
			// Support formats like: "**End Page:** 1" or "End Page: 1" or "End: 1" or "To: 1" or "Page: 1"
			const endPageMatch = recordText.match(/(?:\*\*End Page:\*\*|End Page:|End:|To:|Page:)\s*(\d+)/i);
			// Support formats like: "**Pages Read:** 1" or "Pages Read: 1" or "Pages: 1" or "Read: 1"
			const pagesReadMatch = recordText.match(/(?:\*\*Pages Read:\*\*|Pages Read:|Pages:|Read:)\s*(\d+)/i);
			// Support formats like: "**Timestamp:** 2026-01-28 10:56:10" or "Timestamp: 2026-01-28 10:56:10" or "Time: 2026-01-28 10:56:10"
			const timestampMatch = recordText.match(/(?:\*\*Timestamp:\*\*|Timestamp:|Time:)\s*([^\n]+)/i);
			
			// Extract notes (everything after "Notes:" or after a blank line)
			let notes: string | undefined;
			const notesMatch = recordText.match(/(?:Notes?:|Note:)\s*\n?([\s\S]*?)(?=\n(?:Time|Timestamp)|$)/i);
			if (notesMatch && notesMatch[1]) {
				notes = notesMatch[1].trim();
				if (notes === '') notes = undefined;
			}

			const record: ReadingRecord = {
				date: date,
				startPage: startPageMatch && startPageMatch[1] ? parseInt(startPageMatch[1], 10) : 0,
				endPage: endPageMatch && endPageMatch[1] ? parseInt(endPageMatch[1], 10) : 0,
				pagesRead: pagesReadMatch && pagesReadMatch[1] ? parseInt(pagesReadMatch[1], 10) : 0,
				notes: notes,
				timestamp: timestampMatch && timestampMatch[1] ? timestampMatch[1].trim() : undefined,
			};

			// Calculate pagesRead if not found
			if (record.pagesRead === 0 && record.endPage > record.startPage) {
				record.pagesRead = record.endPage - record.startPage;
			}

			history.push(record);
		}

		return history;
	}

	/**
	 * Update reading history section in body
	 * Creates or updates a "## Reading History" section
	 */
	private updateReadingHistoryInBody(body: string, history: ReadingRecord[]): string {
		// Format reading history as markdown
		const historyLines: string[] = [];
		historyLines.push('## Reading History');
		historyLines.push('');

		// Sort by date (newest first)
		const sortedHistory = [...history].sort((a, b) => {
			const dateA = a.timestamp || a.date || '';
			const dateB = b.timestamp || b.date || '';
			return dateB.localeCompare(dateA);
		});

		for (const record of sortedHistory) {
			historyLines.push(`### ${record.date || 'Unknown Date'}`);
			historyLines.push('');
			historyLines.push(`- **Start Page:** ${record.startPage ?? 0}`);
			historyLines.push(`- **End Page:** ${record.endPage ?? 0}`);
			historyLines.push(`- **Pages Read:** ${record.pagesRead ?? 0}`);
			if (record.timestamp) {
				historyLines.push(`- **Timestamp:** ${record.timestamp}`);
			}
			if (record.notes) {
				historyLines.push(`- **Notes:**`);
				historyLines.push('');
				// Preserve notes formatting (indent by 2 spaces)
				const noteLines = record.notes.split('\n');
				for (const noteLine of noteLines) {
					historyLines.push(`  ${noteLine}`);
				}
			}
			historyLines.push('');
		}

		const historySection = historyLines.join('\n');

		// Remove existing Reading History section if present
		const historySectionRegex = /^##\s+Reading History\s*\n[\s\S]*?(?=\n##|\n#|$)/m;
		let updatedBody = body;

		if (historySectionRegex.test(body)) {
			// Replace existing section
			updatedBody = body.replace(historySectionRegex, historySection);
		} else {
			// Add new section at the end (before any existing ## sections, or at the end)
			// Try to insert before first ## heading
			const firstHeadingRegex = /^(##\s+[^\n]+)/m;
			if (firstHeadingRegex.test(body)) {
				updatedBody = body.replace(firstHeadingRegex, `${historySection}\n\n$1`);
			} else {
				// No headings, append to end
				updatedBody = body.trim() + '\n\n' + historySection;
			}
		}

		return updatedBody;
	}
}
