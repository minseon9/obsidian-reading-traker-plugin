import { Book } from '../../models/book';
import { getCurrentDateTime } from '../../utils/dateUtils';

export class FrontmatterConverter {
	static bookToFrontmatter(book: Book): Record<string, any> {
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
			read_started: book.readStarted || '',
			read_finished: book.readFinished || '',
			read_page: book.readPage || 0,
		};

		if (book.totalPages !== undefined && book.totalPages !== null && !isNaN(book.totalPages)) {
			frontmatter.total = book.totalPages;
		} else {
			frontmatter.total = 0;
		}

		const isbn = `${book.isbn10 || ''} ${book.isbn13 || ''}`.trim();
		if (isbn) {
			frontmatter.isbn = isbn;
		}

		return frontmatter;
	}

	static frontmatterToBook(frontmatter: Record<string, any>): Partial<Book> {
		const { isbn10, isbn13 } = FrontmatterConverter.extractIsbn(frontmatter.isbn);
		const calculatedReadPage = FrontmatterConverter.calculateReadPage(frontmatter);

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

	private static extractIsbn(isbnField: any): { isbn10?: string; isbn13?: string } {
		let isbn10: string | undefined;
		let isbn13: string | undefined;
		if (isbnField) {
			const isbns = String(isbnField).trim().split(/\s+/);
			for (const isbn of isbns) {
				if (isbn.length === 10) isbn10 = isbn;
				else if (isbn.length === 13) isbn13 = isbn;
			}
		}
		return { isbn10, isbn13 };
	}

	private static calculateReadPage(frontmatter: Record<string, any>): number {
		let readPage = typeof frontmatter.read_page === 'number' ? frontmatter.read_page : 0;
		if (frontmatter.reading_history_summary && Array.isArray(frontmatter.reading_history_summary)) {
			const totalFromHistory = frontmatter.reading_history_summary.reduce(
				(sum: number, record: any) => sum + (record.pagesRead || 0),
				0
			);
			if (totalFromHistory > readPage) {
				readPage = totalFromHistory;
			}
		}
		return readPage;
	}
}
