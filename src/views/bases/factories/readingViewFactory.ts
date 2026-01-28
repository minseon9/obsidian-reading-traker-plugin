import BookshelfPlugin from "../../../main";
import { ReadingBasesView } from "../reading";

export function buildReadingViewFactory(plugin: BookshelfPlugin) {
	return (controller: any, containerEl: HTMLElement) => {
		return new ReadingBasesView(controller, containerEl, plugin);
	};
}
