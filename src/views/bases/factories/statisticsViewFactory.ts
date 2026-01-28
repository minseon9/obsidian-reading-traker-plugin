import BookshelfPlugin from "../../../main";
import { StatisticsBasesView } from "../statistics";

export function buildStatisticsViewFactory(plugin: BookshelfPlugin) {
	return (controller: any, containerEl: HTMLElement) => {
		return new StatisticsBasesView(controller, containerEl, plugin);
	};
}
