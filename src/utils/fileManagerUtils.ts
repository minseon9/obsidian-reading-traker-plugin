import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { Book } from '../models/book';
import { TemplateProcessor } from './templateUtils';
import { FrontmatterProcessor } from './frontmatterUtils';
import { ValidationUtils } from './validationUtils';

/**
 * File manager for book notes
 */
export class FileManagerUtils {
	private app: App;
	private templateProcessor: TemplateProcessor;
	private frontmatterProcessor: FrontmatterProcessor;

	constructor(app: App) {
		this.app = app;
		this.templateProcessor = new TemplateProcessor(app);
		this.frontmatterProcessor = new FrontmatterProcessor(app);
	}

	/**
	 * Ensure folder exists, create if not
	 * @param folderPath Folder path
	 */
	async ensureFolder(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}
	}

	/**
	 * Generate safe filename from book title
	 * @param title Book title
	 * @returns Safe filename
	 */
	private generateFileName(title: string): string {
		// Remove invalid characters for filenames
		const sanitized = title
			.replace(/[<>:"/\\|?*]/g, '')
			.replace(/\s+/g, ' ')
			.trim();

		// Limit length
		const maxLength = 100;
		const truncated = sanitized.length > maxLength
			? sanitized.substring(0, maxLength).trim()
			: sanitized;

		return truncated || 'Untitled Book';
	}

	/**
	 * Check if book note already exists
	 * @param folderPath Folder path
	 * @param title Book title
	 * @returns Existing file or null
	 */
	async findExistingBookNote(folderPath: string, title: string): Promise<TFile | null> {
		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder || !(folder instanceof TFolder)) {
			return null;
		}

		const fileName = `${this.generateFileName(title)}.md`;
		const filePath = normalizePath(`${normalizedPath}/${fileName}`);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		return file instanceof TFile ? file : null;
	}

	/**
	 * Get books folder path (bookFolder/books)
	 * @param baseFolder Base folder path
	 * @returns Books folder path
	 */
	getBooksFolderPath(baseFolder: string): string {
		return normalizePath(`${baseFolder}/books`);
	}

	/**
	 * Get interaction folder path (bookFolder/.bookshelf)
	 * @param baseFolder Base folder path
	 * @returns Interaction folder path
	 */
	getInteractionFolderPath(baseFolder: string): string {
		return normalizePath(`${baseFolder}/.bookshelf`);
	}

	/**
	 * Get shelf folder path (bookFolder/shelf) - DEPRECATED, use getViewsFolderPath instead
	 * @param baseFolder Base folder path
	 * @returns Shelf folder path
	 */
	getShelfFolderPath(baseFolder: string): string {
		return normalizePath(`${baseFolder}/shelf`);
	}

	/**
	 * Get views folder path (bookFolder/Views)
	 * @param baseFolder Base folder path
	 * @returns Views folder path
	 */
	getViewsFolderPath(baseFolder: string): string {
		return normalizePath(`${baseFolder}/Views`);
	}

	/**
	 * Create book note from template
	 * @param book Book data
	 * @param baseFolder Base folder path (e.g., "Bookshelf")
	 * @returns Created file
	 */
	async createBookNote(
		book: Book,
		baseFolder: string
	): Promise<TFile> {
		// Use books subfolder
		const booksFolder = this.getBooksFolderPath(baseFolder);
		
		// Ensure folder exists
		await this.ensureFolder(booksFolder);

		// Check if file already exists
		const existing = await this.findExistingBookNote(booksFolder, book.title);
		if (existing) {
			throw new Error(`Book note already exists: ${existing.path}`);
		}

		// Use default template
		const template = this.templateProcessor.getDefaultTemplate();
		const content = this.templateProcessor.processTemplate(template, book);

		// Create file
		const fileName = `${this.generateFileName(book.title)}.md`;
		const filePath = normalizePath(`${booksFolder}/${fileName}`);

		const file = await this.app.vault.create(filePath, content);
		return file;
	}

	/**
	 * Update book note with new data
	 * @param file File to update
	 * @param updates Partial book data to update
	 */
	async updateBookNote(file: TFile, updates: Partial<Book>): Promise<void> {
		const content = await this.app.vault.read(file);
		const { frontmatter, body } = this.frontmatterProcessor.extractFrontmatter(content);

		// Merge updates with existing frontmatter
		const existingBook = this.frontmatterProcessor.frontmatterToBook(frontmatter);
		const updatedBook: Partial<Book> = { ...existingBook, ...updates };

		// Convert back to frontmatter
		const updatedFrontmatter = this.frontmatterProcessor.bookToFrontmatter(
			updatedBook as Book
		);

		// Update timestamp
		updatedFrontmatter.updated = new Date().toISOString().replace('T', ' ').substring(0, 19);

		// Reconstruct file content
		const frontmatterString = this.frontmatterProcessor.createFrontmatter(updatedFrontmatter);
		const newContent = `${frontmatterString}\n${body}`;

		await this.app.vault.modify(file, newContent);
	}

	/**
	 * Update reading progress in book note
	 * @param file File to update
	 * @param page Current page number
	 * @param notes Optional notes
	 * @param autoStatusChange Whether to auto-change status (default: true)
	 */
	async updateReadingProgress(
		file: TFile, 
		endPage: number,
		startPage: number,
		notes?: string,
		autoStatusChange: boolean = true
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const { frontmatter } = this.frontmatterProcessor.extractFrontmatter(content);

		// Get total pages from frontmatter
		const totalPages = typeof frontmatter.total === 'number' 
			? frontmatter.total 
			: (typeof frontmatter.totalPages === 'number' ? frontmatter.totalPages : undefined);

		// Update frontmatter with new progress (using endPage as the current page)
		const updatedContent = this.frontmatterProcessor.updateReadingProgress(
			content,
			endPage,
			totalPages,
			notes,
			autoStatusChange,
			startPage
		);

		await this.app.vault.modify(file, updatedContent);
	}

	/**
	 * Get book data from file
	 * @param file File to read
	 * @param validate Whether to validate and fix data (default: true)
	 * @returns Book data
	 */
	async getBookFromFile(file: TFile, validate: boolean = true): Promise<Partial<Book>> {
		const content = await this.app.vault.read(file);
		const { frontmatter } = this.frontmatterProcessor.extractFrontmatter(content);
		const book = this.frontmatterProcessor.frontmatterToBook(frontmatter);
		
		// Validate and fix if requested
		if (validate) {
			return ValidationUtils.validateAndFixBook(book);
		}
		
		return book;
	}

	/**
	 * Ensure base view file exists (Bookshelf/shelf/base.md)
	 * @param baseFolder Base folder path
	 */
	async ensureBaseViewFile(baseFolder: string): Promise<void> {
		const shelfFolder = this.getShelfFolderPath(baseFolder);
		await this.ensureFolder(shelfFolder);

		const baseFilePath = normalizePath(`${shelfFolder}/base.md`);
		const existingFile = this.app.vault.getAbstractFileByPath(baseFilePath);

		if (!existingFile) {
			// Create base view file with Bookshelf View content
			const baseContent = `---
title: Bookshelf
type: bookshelf-view
---

# Bookshelf

This is the main Bookshelf view page. Use the "Open Bookshelf" command or ribbon icon to view your books.

## Quick Actions

- **Search and Add Book**: Use the ribbon icon or command to search and add new books
- **Update Progress**: Click on a reading book card or use the command to update reading progress

## Your Books

Books are stored in the \`books\` folder and displayed here based on their reading status.

- **Reading**: Books you're currently reading (shown with cover images)
- **Unread**: Books you haven't started yet (shown as shelf spines)
- **Finished**: Books you've completed (shown as shelf spines)
`;

			await this.app.vault.create(baseFilePath, baseContent);
		}
	}
}
