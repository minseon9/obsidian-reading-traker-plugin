import type { BookshelfSettings } from "../../../settings/types";

export class LibraryBaseFileGenerator {
	static generate(settings: BookshelfSettings): string {
		const booksFolder = `${settings.bookFolder}/books`;
		
		return `filters:
  and:
    - file.path.startsWith("${booksFolder}/")
    - file.path.endsWith(".md")
    - note.status == "unread" || note.status == "finished"

order:
  - note.status
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
  - id: note.total
    display-name: Total Pages
    type: number
  - id: file.ctime
    display-name: Added
    type: date
  - id: note.read_finished
    display-name: Finished
    type: date

views:
  - type: bookshelfLibraryView
    name: Library
`;
	}
}
