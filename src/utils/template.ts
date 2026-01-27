import { App, TFile } from 'obsidian';
import { Book } from '../models/book';
import { formatDate, getCurrentDateTime } from './dateUtils';

/**
 * Template processor for book notes
 */
export class TemplateProcessor {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Load template file content
	 * @param templatePath Template file path
	 * @returns Template content or default template if file not found
	 */
	async loadTemplate(templatePath: string): Promise<string> {
		try {
			const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
			if (templateFile instanceof TFile) {
				return await this.app.vault.read(templateFile);
			}
		} catch (error) {
			// Template file not found, use default
		}

		// Return default template if file not found
		return this.getDefaultTemplate();
	}

	/**
	 * Process template with book data
	 * @param template Template content
	 * @param book Book data
	 * @returns Processed content
	 */
	processTemplate(template: string, book: Book): string {
		const data = this.prepareTemplateData(book);
		return this.replacePlaceholders(template, data);
	}

	/**
	 * Prepare template data from book
	 * @param book Book data
	 * @returns Template data object
	 */
	private prepareTemplateData(book: Book): Record<string, string> {
		const now = new Date();
		const dateFormat = 'YYYY-MM-DD HH:mm:ss';

		return {
			title: book.title || '',
			subtitle: book.subtitle || '',
			author: this.formatAuthorArray(book.author || []),
			category: this.formatArray(book.category || []),
			publisher: book.publisher || '',
			publishDate: book.publishDate || '',
			totalPage: book.totalPages?.toString() || '',
			isbn10: book.isbn10 || '',
			isbn13: book.isbn13 || '',
			coverUrl: book.coverUrl || '',
			localCoverImage: book.localCover || '',
			page: book.readPage?.toString() || '0',
		};
	}

	/**
	 * Format author array for template
	 * @param authors Author array
	 * @returns Formatted string (e.g., "Author1", "Author2")
	 */
	private formatAuthorArray(authors: string[]): string {
		if (authors.length === 0) {
			return '';
		}
		return authors.map(a => `"${a}"`).join(', ');
	}

	/**
	 * Format array for template
	 * @param items Array of strings
	 * @returns Formatted string (e.g., "Item1", "Item2")
	 */
	private formatArray(items: string[]): string {
		if (items.length === 0) {
			return '';
		}
		return items.map(item => `"${item}"`).join(', ');
	}

	/**
	 * Replace placeholders in template
	 * @param template Template content
	 * @param data Data object
	 * @returns Processed template
	 */
	private replacePlaceholders(template: string, data: Record<string, string>): string {
		let result = template;

		// Replace date placeholders ({{DATE:FORMAT}})
		result = result.replace(/\{\{DATE:([^}]+)\}\}/g, (match, format) => {
			return formatDate(new Date(), format);
		});

		// Replace simple placeholders ({{key}})
		for (const [key, value] of Object.entries(data)) {
			const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
			result = result.replace(placeholder, value);
		}

		return result;
	}

	/**
	 * Get default template
	 * @returns Default template content
	 */
	private getDefaultTemplate(): string {
		return `---
tag: 📚Book
title: "{{title}}"
subtitle: "{{subtitle}}"
author: [{{author}}]
category: [{{category}}]
publisher: {{publisher}}
publish: {{publishDate}}
total: {{totalPage}}
isbn: {{isbn10}} {{isbn13}}
cover: {{coverUrl}}
localCover: {{localCoverImage}}
status: unread
created: {{DATE:YYYY-MM-DD HH:mm:ss}}
updated: {{DATE:YYYY-MM-DD HH:mm:ss}}
read_started: {{DATE:YYYY-MM-DD HH:mm:ss}}
read_finished: {{DATE:YYYY-MM-DD HH:mm:ss}}
read_page: {{page}}
---

# {{title}}
`;
	}
}
