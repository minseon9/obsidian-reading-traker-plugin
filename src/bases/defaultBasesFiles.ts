/**
 * Default .base file templates for Bookshelf views
 * These are created in Bookshelf/Views/ directory when the user first uses the commands
 */

import type { BookshelfSettings } from "../settings";

/**
 * Generate default Bookshelf view .base file content (reading books only)
 */
export function generateBookshelfBaseFile(settings: BookshelfSettings): string {
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


/**
 * Generate Library view .base file content (unread and finished books)
 */
export function generateLibraryBaseFile(settings: BookshelfSettings): string {
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


/**
 * Generate Statistics view .base file content
 */
export function generateStatisticsBaseFile(settings: BookshelfSettings): string {
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
