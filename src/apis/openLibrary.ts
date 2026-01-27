import { Book, createBookFromData } from '../models/book';
import { HttpClient } from '../utils/httpClient';
import {
	OpenLibrarySearchResponse,
	OpenLibrarySearchDoc,
	OpenLibraryWork,
	OpenLibraryEdition,
	OpenLibraryEditionsResponse,
} from './types';

/**
 * Open Library API client
 */
export class OpenLibraryClient {
	private baseUrl = 'https://openlibrary.org';
	private httpClient: HttpClient;

	constructor(timeout: number = 5000) {
		this.httpClient = new HttpClient(timeout);
	}

	/**
	 * Search books by query
	 * @param query Search query
	 * @param limit Maximum number of results (default: 20)
	 * @returns Array of Book objects
	 */
	async searchBooks(query: string, limit: number = 20): Promise<Book[]> {
		try {
			const encodedQuery = encodeURIComponent(query);
			const url = `${this.baseUrl}/search.json?q=${encodedQuery}&limit=${limit}`;

			const data = await this.httpClient.get<OpenLibrarySearchResponse>(url);
			return this.convertSearchDocsToBooks(data.docs);
		} catch (error) {
			throw new Error(`Failed to search books. Please try again later.`);
		}
	}

	/**
	 * Get book details by work key
	 * @param workKey Work key (e.g., "/works/OL123456W")
	 * @returns Book object
	 */
	async getBookDetails(workKey: string): Promise<Book> {
		try {
			const url = `${this.baseUrl}${workKey}.json`;
			const work = await this.httpClient.get<OpenLibraryWork>(url);

			// Get edition details if available (optional, failures are ignored)
			const edition = await this.getFirstEdition(work.key);

			return this.convertWorkToBook(work, edition);
		} catch (error) {
			throw new Error(`Failed to get book details. Please try again later.`);
		}
	}

	/**
	 * Get book cover image URL
	 * @param coverId Cover ID or ISBN
	 * @param size Image size ('S', 'M', 'L')
	 * @returns Cover image URL
	 */
	getBookCover(coverId: number | string, size: 'S' | 'M' | 'L' = 'M'): string {
		const sizeMap = {
			S: '-S',
			M: '-M',
			L: '-L',
		};

		// If coverId is a number, use cover ID
		if (typeof coverId === 'number') {
			return `https://covers.openlibrary.org/b/id/${coverId}${sizeMap[size]}.jpg`;
		}

		// If coverId is a string (ISBN), use ISBN
		return `https://covers.openlibrary.org/b/isbn/${coverId}${sizeMap[size]}.jpg`;
	}

	/**
	 * Get first edition for a work (optional, returns null on failure)
	 * @param workKey Work key
	 * @returns First edition or null if not available
	 */
	private async getFirstEdition(workKey: string | undefined): Promise<OpenLibraryEdition | null> {
		if (!workKey) {
			return null;
		}

		try {
			const editionsUrl = `${this.baseUrl}${workKey}/editions.json`;
			const editionsData = await this.httpClient.get<OpenLibraryEditionsResponse>(editionsUrl);
			if (editionsData.entries && editionsData.entries.length > 0 && editionsData.entries[0]) {
				return editionsData.entries[0];
			}
		} catch (e) {
			// Ignore edition fetch errors - work data is sufficient
		}

		return null;
	}

	/**
	 * Convert search document to Book
	 */
	private convertSearchDocToBook(doc: OpenLibrarySearchDoc): Book {
		const authors = doc.author_name || [];
		const isbn10 = doc.isbn?.find(isbn => isbn.length === 10);
		const isbn13 = doc.isbn?.find(isbn => isbn.length === 13);

		let coverUrl: string | undefined;
		if (doc.cover_i) {
			coverUrl = this.getBookCover(doc.cover_i, 'M');
		} else if (isbn13) {
			coverUrl = this.getBookCover(isbn13, 'M');
		} else if (isbn10) {
			coverUrl = this.getBookCover(isbn10, 'M');
		}

		const publishYear = doc.first_publish_year || doc.publish_year?.[0];
		const publishDate = publishYear ? publishYear.toString() : doc.publish_date?.[0];

		return createBookFromData({
			title: doc.title,
			subtitle: doc.subtitle,
			author: authors,
			isbn10,
			isbn13,
			publisher: doc.publisher?.[0],
			publishDate,
			totalPages: doc.number_of_pages_median,
			coverUrl,
			category: doc.subject?.slice(0, 5), // Limit to first 5 subjects
		});
	}

	/**
	 * Convert multiple search documents to Books
	 */
	private convertSearchDocsToBooks(docs: OpenLibrarySearchDoc[]): Book[] {
		return docs.map(doc => this.convertSearchDocToBook(doc));
	}

	/**
	 * Convert Work to Book
	 */
	private convertWorkToBook(work: OpenLibraryWork, edition?: OpenLibraryEdition | null): Book {
		// Extract author names
		// Work API doesn't provide author names directly, only keys
		// Edition API may provide author names, otherwise we'll have empty authors
		const authors: string[] = [];
		if (edition?.authors) {
			authors.push(...edition.authors.map(a => a.name || '').filter(name => name.length > 0));
		}
		
		const isbn10 = edition?.isbn_10?.[0] || work.isbn_10?.[0];
		const isbn13 = edition?.isbn_13?.[0] || work.isbn_13?.[0];

		let coverUrl: string | undefined;
		if (work.covers && work.covers.length > 0 && work.covers[0] !== undefined) {
			coverUrl = this.getBookCover(work.covers[0], 'M');
		} else if (isbn13) {
			coverUrl = this.getBookCover(isbn13, 'M');
		} else if (isbn10) {
			coverUrl = this.getBookCover(isbn10, 'M');
		}

		return createBookFromData({
			title: work.title,
			subtitle: work.subtitle,
			author: authors,
			isbn10,
			isbn13,
			publisher: edition?.publishers?.[0] || work.publishers?.[0],
			publishDate: edition?.publish_date || work.publish_date,
			totalPages: edition?.number_of_pages || work.number_of_pages,
			coverUrl,
			category: work.subjects?.slice(0, 5),
		});
	}
}
