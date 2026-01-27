import { Book } from '../models/book';
import { ReadingRecord } from '../models/readingRecord';

/**
 * Validation utilities for book data
 */
export class ValidationUtils {
	/**
	 * Validate book data
	 * @param book Book data to validate
	 * @returns Array of validation errors (empty if valid)
	 */
	static validateBook(book: Partial<Book>): string[] {
		const errors: string[] = [];

		if (!book.title || book.title.trim().length === 0) {
			errors.push('Title is required');
		}

		if (book.readPage !== undefined && book.readPage < 0) {
			errors.push('Read page must be non-negative');
		}

		if (book.totalPages !== undefined && book.totalPages < 0) {
			errors.push('Total pages must be non-negative');
		}

		if (book.readPage !== undefined && book.totalPages !== undefined) {
			if (book.readPage > book.totalPages) {
				errors.push('Read page cannot exceed total pages');
			}
		}

		if (book.status && !['unread', 'reading', 'finished'].includes(book.status)) {
			errors.push('Invalid status');
		}

		return errors;
	}

	/**
	 * Validate reading record
	 * @param record Reading record to validate
	 * @returns Array of validation errors (empty if valid)
	 */
	static validateReadingRecord(record: Partial<ReadingRecord>): string[] {
		const errors: string[] = [];

		if (record.startPage !== undefined && record.startPage < 0) {
			errors.push('Start page must be non-negative');
		}

		if (record.endPage !== undefined && record.endPage < 0) {
			errors.push('End page must be non-negative');
		}

		if (record.startPage !== undefined && record.endPage !== undefined) {
			if (record.endPage < record.startPage) {
				errors.push('End page must be greater than or equal to start page');
			}
		}

		if (record.pagesRead !== undefined && record.pagesRead < 0) {
			errors.push('Pages read must be non-negative');
		}

		return errors;
	}

	/**
	 * Validate and fix book data (attempts to fix common issues)
	 * @param book Book data to validate and fix
	 * @returns Fixed book data
	 */
	static validateAndFixBook(book: Partial<Book>): Partial<Book> {
		const fixed: Partial<Book> = { ...book };

		// Fix negative values
		if (fixed.readPage !== undefined && fixed.readPage < 0) {
			fixed.readPage = 0;
		}

		if (fixed.totalPages !== undefined && fixed.totalPages < 0) {
			fixed.totalPages = undefined;
		}

		// Fix readPage exceeding totalPages
		if (fixed.readPage !== undefined && fixed.totalPages !== undefined) {
			if (fixed.readPage > fixed.totalPages) {
				fixed.readPage = fixed.totalPages;
			}
		}

		// Fix invalid status
		if (fixed.status && !['unread', 'reading', 'finished'].includes(fixed.status)) {
			fixed.status = 'unread';
		}

		// Ensure title is not empty
		if (!fixed.title || fixed.title.trim().length === 0) {
			fixed.title = 'Unknown Title';
		}

		return fixed;
	}

	/**
	 * Check if book data is valid
	 * @param book Book data to check
	 * @returns True if valid, false otherwise
	 */
	static isBookValid(book: Partial<Book>): boolean {
		return this.validateBook(book).length === 0;
	}
}
