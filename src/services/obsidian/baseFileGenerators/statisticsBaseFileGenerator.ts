import type { BookshelfSettings } from "../../../settings/types";

export class StatisticsBaseFileGenerator {
	static generate(settings: BookshelfSettings): string {
		const booksFolder = `${settings.bookFolder}/books`;
		
		return `filters:
  and:
    - file.path.startsWith("${booksFolder}/")
    - file.path.endsWith(".md")

views:
  - type: bookshelfStatisticsView
    name: Statistics
`;
	}
}
