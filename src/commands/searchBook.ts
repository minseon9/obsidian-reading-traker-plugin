import { App } from 'obsidian';
import { SearchModal } from '../views/searchModal';
import BookshelfPlugin from '../main';

/**
 * Search book command
 */
export function registerSearchBookCommand(app: App, plugin: BookshelfPlugin): void {
	plugin.addCommand({
		id: 'bookshelf-search-book',
		name: 'Search book',
		callback: () => {
			const modal = new SearchModal(app, plugin);
			modal.open();
		},
	});
}
