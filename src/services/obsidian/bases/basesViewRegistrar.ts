import BookshelfPlugin from "../../../main";
import {requireApiVersion} from "obsidian";
import {registerBasesView, unregisterBasesView} from "./basesPluginClient";
import { BookshelfBasesView } from "../../../views/bases/bookshelf";
import { ReadingBasesView } from "../../../views/bases/reading";
import { LibraryBasesView } from "../../../views/bases/library";
import { StatisticsBasesView } from "../../../views/bases/statistics";

/**
 * Register Bookshelf views with Bases plugin
 * Requires Obsidian 1.10.1+ (public Bases API with groupBy support)
 */
export async function registerBasesBookshelfView(plugin: BookshelfPlugin): Promise<void> {
	// All views now require Obsidian 1.10.1+ (public Bases API with groupBy support)
	if (!requireApiVersion("1.10.1")) {
		console.warn("[Bookshelf][Bases] Obsidian 1.10.1+ required for Bases integration");
		return;
	}

	const attemptRegistration = (): boolean => {
		try {
			// Register Bookshelf View (all books)
			const bookshelfSuccess = registerBasesView(plugin, "bookshelfView", {
				name: "Bookshelf View",
				icon: "book-open",
				factory: (controller: unknown, containerEl: HTMLElement) => {
					return new BookshelfBasesView(controller, containerEl, plugin);
				},
			});

			// Register Reading View
			const readingSuccess = registerBasesView(plugin, "bookshelfReadingView", {
				name: "Reading Books",
				icon: "book-open-text",
				factory: (controller: unknown, containerEl: HTMLElement) => {
					return new ReadingBasesView(controller, containerEl, plugin);
				},
			});

			// Register Library View
			const librarySuccess = registerBasesView(plugin, "bookshelfLibraryView", {
				name: "Library",
				icon: "library",
				factory: (controller: unknown, containerEl: HTMLElement) => {
					return new LibraryBasesView(controller, containerEl, plugin);
				},
			});

			// Register Statistics View
			const statisticsSuccess = registerBasesView(plugin, "bookshelfStatisticsView", {
				name: "Reading Statistics",
				icon: "bar-chart",
				factory: (controller: unknown, containerEl: HTMLElement) => {
					return new StatisticsBasesView(controller, containerEl, plugin);
				},
			});

			if (!bookshelfSuccess && !readingSuccess && !librarySuccess && !statisticsSuccess) {
				console.debug("[Bookshelf][Bases] Bases plugin not available for registration");
				return false;
			}

		// Refresh existing Bases views
		plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view?.getViewType?.() === "bases") {
				const view = leaf.view as { refresh?: () => void };
				if (typeof view.refresh === "function") {
					try {
						view.refresh();
					} catch (refreshError) {
						console.debug(
							"[Bookshelf][Bases] Error refreshing view:",
							refreshError
						);
					}
				}
			}
		});

			return true;
		} catch (error) {
			console.warn("[Bookshelf][Bases] Registration attempt failed:", error);
			return false;
		}
	};

	// Try immediate registration
	if (attemptRegistration()) {
		return;
	}

	// If that fails, try a few more times with short delays
	for (let i = 0; i < 5; i++) {
		await new Promise((r) => setTimeout(r, 200));
		if (attemptRegistration()) {
			return;
		}
	}

	console.warn("[Bookshelf][Bases] Failed to register views after multiple attempts");
}

/**
 * Unregister Bookshelf views from Bases plugin
 */
export function unregisterBasesViews(plugin: BookshelfPlugin): void {
	try {
		// Unregister all views
		unregisterBasesView(plugin, "bookshelfView");
		unregisterBasesView(plugin, "bookshelfReadingView");
		unregisterBasesView(plugin, "bookshelfLibraryView");
		unregisterBasesView(plugin, "bookshelfStatisticsView");
	} catch (error) {
		console.error("[Bookshelf][Bases] Error during view unregistration:", error);
	}
}

