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
	 * Get default template (public method)
	 * @returns Default template content
	 */
	getDefaultTemplate(): string {
		return this.getDefaultTemplateContent();
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

		// Remove Templater syntax blocks (they are not processed by our simple template system)
		// Remove lines with <%* ... %> syntax
		result = result.replace(/<%[\s\S]*?%>/g, '');
		
		// Remove comment lines that reference Templater
		result = result.replace(/^%%[\s\S]*?%%$/gm, '');

		// Replace date placeholders ({{DATE:FORMAT}})
		result = result.replace(/\{\{DATE:([^}]+)\}\}/g, (match, format) => {
			return formatDate(new Date(), format);
		});

		// Replace simple placeholders ({{key}})
		for (const [key, value] of Object.entries(data)) {
			const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
			result = result.replace(placeholder, value);
		}

		// Clean up multiple empty lines
		result = result.replace(/\n{3,}/g, '\n\n');

		return result.trim();
	}

	/**
	 * Get default template
	 * @returns Default template content
	 */
	private getDefaultTemplateContent(): string {
		return `---
title: "{{title}}"
subtitle: "{{subtitle}}"
author: [{{author}}]
category: [{{category}}]
publisher: {{publisher}}
publish: {{publishDate}}
total: {{totalPage}}
isbn: {{isbn10}} {{isbn13}}
cover: {{coverUrl}}
status: unread
created: {{DATE:YYYY-MM-DD HH:mm:ss}}
updated: {{DATE:YYYY-MM-DD HH:mm:ss}}
read_started: {{DATE:YYYY-MM-DD HH:mm:ss}}
read_finished: {{DATE:YYYY-MM-DD HH:mm:ss}}
read_page: {{page}}
---

%% To use an image URL from the server, use the following syntax: %%
<%* if (tp.frontmatter.cover && tp.frontmatter.cover.trim() !== "") { tR += \`![cover|150](\${tp.frontmatter.cover})\` } %>

# {{title}}
`;
	}
}
