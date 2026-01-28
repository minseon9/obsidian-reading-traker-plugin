import type { BookshelfSettings } from "../../../settings/types";

export class BookshelfBaseFileGenerator {
	static generate(settings: BookshelfSettings): string {
		const booksFolder = `${settings.bookFolder}/books`;
		
		return `filters:
  and:
    - file.path.startsWith("${booksFolder}/")
    - file.path.endsWith(".md")
    - note.status == "reading" || note.status == "unread"

order:
  - note.status
  - note.read_page
  - file.ctime

columns:
  - id: file.name
    display-name: Title
    type: text
  - id: note.author
    display-name: Author
    type: list
  - id: note.status
    display-name: Status
    type: text
  - id: note.read_page
    display-name: Progress
    type: number
  - id: note.total
    display-name: Total Pages
    type: number

views:
  - type: bookshelfView
    name: Bookshelf
`;
	}
}
