import { App, TFile, normalizePath } from 'obsidian';
import { Book } from '../../models/book';
import { FrontmatterParser } from '../frontmatterService/frontmatterParser';
import { FrontmatterConverter } from '../frontmatterService/frontmatterConverter';
import { ValidationUtils } from '../validationService';
import { FileNameGenerator } from '../pathService/fileNameGenerator';

export class BookFileReader {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async read(file: TFile, validate: boolean = true): Promise<Partial<Book>> {
		const content = await this.app.vault.read(file);
		const { frontmatter } = FrontmatterParser.extract(content);
		const book = FrontmatterConverter.frontmatterToBook(frontmatter);
		
		if (validate) {
			return ValidationUtils.validateAndFixBook(book);
		}
		
		return book;
	}

	findExisting(folderPath: string, title: string): TFile | null {
		const fileName = `${FileNameGenerator.generate(title)}.md`;
		const filePath = normalizePath(`${folderPath}/${fileName}`);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		return file instanceof TFile ? file : null;
	}
}
