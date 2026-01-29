import { Component, App, TFile, setIcon } from "obsidian";
import BookshelfPlugin from "../../main";
import { BasesDataItem, BasesEntryData } from "./basesDataItem";
import { Book } from "../../models/book";
import { BookFileReader } from "../../services/bookFileService/bookFileReader";
import { BookFileUpdater } from "../../services/bookFileService/bookFileUpdater";

/**
 * Minimal interface for Bases view configuration
 */
interface BasesViewConfig {
	getSort?: () => unknown;
	getOrder?: () => string[];
	getDisplayName?: (propertyId: string) => string;
}

/**
 * Minimal interface for Bases query result
 */
interface BasesQueryResult {
	data?: unknown;
	groupedData?: unknown[];
}

/**
 * Abstract base class for all Bookshelf Bases views.
 * Properly extends Component to leverage lifecycle, and implements BasesView interface.
 */
export abstract class BasesViewBase extends Component {
	// BasesView properties (provided by Bases when factory returns this instance)
	app!: App;
	config!: BasesViewConfig;
	data!: BasesQueryResult;
	protected plugin: BookshelfPlugin;
	protected containerEl: HTMLElement;
	protected rootElement: HTMLElement | null = null;
	protected bookFileReader: BookFileReader;
	protected bookFileUpdater: BookFileUpdater;
	protected updateDebounceTimer: number | null = null;
	protected dataUpdateDebounceTimer: number | null = null;

	constructor(controller: unknown, containerEl: HTMLElement, plugin: BookshelfPlugin) {
		// Call Component constructor
		super();
		this.plugin = plugin;
		this.containerEl = containerEl;
		// Use plugin.app since this.app may not be set yet (Bases sets it later)
		this.bookFileReader = new BookFileReader(plugin.app);
		this.bookFileUpdater = new BookFileUpdater(plugin.app);

		// Note: app, config, and data will be set by Bases when it creates the view
		// We just need to ensure our types match the BasesView interface
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		this.setupContainer();
		
		// Wait a bit for Bases to populate data
		// Use requestAnimationFrame for better timing
		requestAnimationFrame(() => {
			setTimeout(() => {
				if (this.rootElement?.isConnected) {
					void this.render();
				}
			}, 100);
		});
	}

	/**
	 * BasesView lifecycle: Called when Bases data changes.
	 * Required abstract method implementation.
	 * Debounced to prevent excessive re-renders during rapid file saves.
	 */
	onDataUpdated(): void {
		
		// Skip if view is not visible
		if (!this.rootElement?.isConnected) {
			return;
		}

		// Debounce data updates to avoid freezing during typing
		if (this.dataUpdateDebounceTimer) {
			clearTimeout(this.dataUpdateDebounceTimer);
		}

		// Use correct window for pop-out window support
		const win = this.containerEl.ownerDocument.defaultView || window;
		this.dataUpdateDebounceTimer = win.setTimeout(() => {
			this.dataUpdateDebounceTimer = null;
			try {
				void this.render();
			} catch (error) {
				console.error(`[Bookshelf][${this.type}] Render error:`, error);
				this.renderError(error as Error);
			}
		}, 500); // 500ms debounce for data updates
	}

	/**
	 * Component lifecycle: Called when view is unloaded.
	 */
	onunload(): void {
		if (this.dataUpdateDebounceTimer) {
			clearTimeout(this.dataUpdateDebounceTimer);
		}
		if (this.updateDebounceTimer) {
			clearTimeout(this.updateDebounceTimer);
		}
		super.onunload();
	}

	/**
	 * Setup the container element
	 */
	protected setupContainer(): void {
		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

	// Don't clear containerEl - Bases manages it
	// Just create our root element inside it
	const rootEl = doc.createElement("div");
	rootEl.className = "bookshelf-bases-view";
	rootEl.setCssProps({
		display: "flex",
		"flex-direction": "column",
		height: "100%",
		width: "100%"
	});
	rootEl.tabIndex = -1; // Make focusable without adding to tab order
	this.containerEl.appendChild(rootEl);
	this.rootElement = rootEl;

		// Add custom "New Book" button and hide the default Bases "New" button
		this.setupNewBookButton();
	}

	/**
	 * Setup custom "New Book" button that opens Bookshelf search modal.
	 * Injects the button into the Bases toolbar and hides the default "New" button.
	 */
	protected setupNewBookButton(): void {
		// Defer to allow Bases to render its toolbar first
		// Try multiple times in case toolbar isn't ready yet
		let attempts = 0;
		const maxAttempts = 10;
		
		const tryInject = () => {
			attempts++;
			this.injectNewBookButton();
			
			// If button wasn't injected, try again
			const basesViewEl = this.containerEl.closest(".bases-view");
			const parentEl = basesViewEl?.parentElement;
			const toolbarEl = parentEl?.querySelector(".bases-toolbar");
			const buttonExists = toolbarEl?.querySelector(".bookshelf-bases-new-book-btn");
			
			if (!buttonExists && attempts < maxAttempts) {
				setTimeout(tryInject, 200);
			}
		};
		
		setTimeout(tryInject, 100);

		// Register cleanup to toggle off the active class when view is unloaded
		this.register(() => this.cleanupNewBookButton());
	}

	/**
	 * Clean up: just remove the "active" class, keep the button for reuse.
	 */
	private cleanupNewBookButton(): void {
		const basesViewEl = this.containerEl.closest(".bases-view");
		const parentEl = basesViewEl?.parentElement;

		// Only remove the "active" class - button stays for potential reuse
		parentEl?.classList.remove("bookshelf-view-active");
	}

	/**
	 * Inject the custom "New Book" button into the Bases toolbar.
	 */
	private injectNewBookButton(): void {
		// Find the Bases view container
		const basesViewEl = this.containerEl.closest(".bases-view");
		if (!basesViewEl) {
			console.debug("[Bookshelf][Bases] No .bases-view found");
			return;
		}

		// The toolbar is a sibling of .bases-view, not a child
		// Look in the parent container for the toolbar
		const parentEl = basesViewEl.parentElement;
		if (!parentEl) {
			console.debug("[Bookshelf][Bases] No parent element found");
			return;
		}

		// Mark parent as having an active Bookshelf view (controls visibility via CSS)
		parentEl.classList.add("bookshelf-view-active");

		const toolbarEl = parentEl.querySelector(".bases-toolbar");
		if (!toolbarEl) {
			console.debug("[Bookshelf][Bases] No .bases-toolbar found in parent");
			return;
		}

		// Check if we already added the button (reuse existing)
		if (toolbarEl.querySelector(".bookshelf-bases-new-book-btn")) {
			return;
		}

		// Use correct document for pop-out window support
		const doc = this.containerEl.ownerDocument;

		// Create "New Book" button matching Bases' text-icon-button style
		const newBookBtn = doc.createElement("div");
		newBookBtn.className = "bases-toolbar-item bookshelf-bases-new-book-btn";

		const innerBtn = doc.createElement("div");
		innerBtn.className = "text-icon-button";
		innerBtn.tabIndex = 0;

		// Add icon
		const iconSpan = doc.createElement("span");
		iconSpan.className = "text-button-icon";
		setIcon(iconSpan, "book-plus");
		innerBtn.appendChild(iconSpan);

		// Add label
		const labelSpan = doc.createElement("span");
		labelSpan.className = "text-button-label";
		labelSpan.textContent = "New book";
		innerBtn.appendChild(labelSpan);

		newBookBtn.appendChild(innerBtn);

		// Add click handler - use direct function reference
		const handleClick = async (e: Event) => {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
			
			// Use plugin.app instead of this.app (which may not be set yet in Bases context)
			const app = this.app || this.plugin.app;
			if (!app) {
				console.error("[Bookshelf][Bases] App not available");
				return;
			}
			
			try {
				const { SearchModal } = await import("../bookSearchModal");
				const modal = new SearchModal(app, this.plugin);
				modal.open();
			} catch (error) {
				console.error("[Bookshelf][Bases] Error opening search modal:", error);
			}
		};
		
		// Add to inner button with capture phase
		innerBtn.addEventListener("click", handleClick, { capture: true, once: false });
		
		// Also add mousedown as backup
		innerBtn.addEventListener("mousedown", (e) => {
			if (e.button === 0) { // Left click only
				void handleClick(e);
			}
		}, { capture: true });

		// Also handle keyboard events
		innerBtn.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.stopPropagation();
				e.preventDefault();
				void handleClick(e);
			}
		});

		// Find the original "New" button position and insert our button there
		const originalNewBtn = toolbarEl.querySelector(".bases-toolbar-new-item-menu");
		if (originalNewBtn) {
			// Insert before the original (which will be hidden by CSS)
			originalNewBtn.before(newBookBtn);
		} else {
			// Fallback: append to end of toolbar
			toolbarEl.appendChild(newBookBtn);
		}

		console.debug("[Bookshelf][Bases] Injected New Book button into toolbar");
	}

	/**
	 * Extract all data items from Bases query result.
	 * Uses public API: this.data.data
	 *
	 * NOTE: This only extracts frontmatter and basic file properties (cheap).
	 * Computed file properties (backlinks, links, etc.) are fetched lazily
	 * via getComputedProperty() during rendering for visible items only.
	 */
	protected extractDataItems(): BasesDataItem[] {
		if (!this.data?.data) {
			console.warn("[Bookshelf][BasesView] No data available");
			return [];
		}
		
		const entries = this.data.data as unknown[];
		
		return entries.map((entry: unknown) => {
			const e = entry as BasesEntryData;
			if (!e?.file?.path) {
				console.warn("[Bookshelf][BasesView] Entry missing file.path:", e);
				return null;
			}
			
			return {
				key: e.file.path,
				data: e,
				file: e.file,
				path: e.file.path,
				properties: this.extractEntryProperties(e),
				basesData: e,
			};
		}).filter((item: BasesDataItem | null): item is BasesDataItem => item !== null);
	}

	/**
	 * Extract properties from a Bases entry
	 */
	private extractEntryProperties(entry: BasesEntryData): Record<string, unknown> {
		const properties: Record<string, unknown> = {};
		
		// Extract note properties (frontmatter)
		if (entry.note) {
			Object.assign(properties, entry.note);
		}
		
		// Extract file properties
		if (entry.file) {
			properties['file.name'] = entry.file.name;
			properties['file.path'] = entry.file.path;
			properties['file.ctime'] = entry.file.ctime;
			properties['file.mtime'] = entry.file.mtime;
		}
		
		return properties;
	}

	/**
	 * Extract books from Bases data items
	 */
	protected 	async extractBooksFromBasesData(dataItems: BasesDataItem[]): Promise<Array<{ book: Book; file: TFile }>> {
		const books: Array<{ book: Book; file: TFile }> = [];

		for (const item of dataItems) {
			try {
				const file = item.file;
				if (!file || !file.path) {
					continue;
				}


				// Get file from vault - use plugin.app as fallback since this.app may not be set yet
				const app = this.app || this.plugin.app;
				if (!app) {
					continue;
				}
				
				const vaultFile = app.vault.getAbstractFileByPath(file.path);
				if (!vaultFile || !(vaultFile instanceof TFile)) {
					continue;
				}

				// Load book data from file
				const bookData = await this.bookFileReader.read(vaultFile);
				if (bookData.title) {
				// Get reading history summary from frontmatter (for statistics)
				// This is faster than parsing body and contains essential data
				let lastReadDate: string | undefined;
				let totalPagesReadFromHistory: number | undefined;
				try {
					const content = await app.vault.read(vaultFile);
					const { FrontmatterParser } = await import('../../services/frontmatterService/frontmatterParser');
					const { frontmatter } = FrontmatterParser.extract(content);
					
					// Use reading_history_summary from frontmatter (for statistics)
					const historySummary = frontmatter.reading_history_summary;
					if (historySummary && Array.isArray(historySummary) && historySummary.length > 0) {
						// Get most recent record for last read date
						interface HistoryRecord {
							date?: string;
							timestamp?: string;
							pagesRead?: number;
						}
						const sorted = [...historySummary].sort((a: unknown, b: unknown) => {
							const recordA = a as HistoryRecord;
							const recordB = b as HistoryRecord;
							const dateA = recordA.date || recordA.timestamp || '';
							const dateB = recordB.date || recordB.timestamp || '';
							return dateB.localeCompare(dateA);
						});
						const latest = sorted[0] as HistoryRecord;
						if (latest?.date) {
							lastReadDate = latest.date;
						} else if (latest?.timestamp) {
							lastReadDate = latest.timestamp.split(' ')[0];
						}
						
						// Calculate total pages read from all history records
						totalPagesReadFromHistory = historySummary.reduce((sum: number, record: unknown) => {
							const r = record as HistoryRecord;
							return sum + (r.pagesRead || 0);
						}, 0);
					}
				} catch {
					// Ignore errors
				}

					// Use pages read from history summary if available and more accurate than frontmatter
					const effectiveReadPage = totalPagesReadFromHistory !== undefined && totalPagesReadFromHistory > (bookData.readPage || 0)
						? totalPagesReadFromHistory
						: bookData.readPage;

					const validStatus = bookData.status === 'unread' || bookData.status === 'reading' || bookData.status === 'finished'
						? bookData.status
						: 'unread';
					
					const book: Book & { lastReadDate?: string } = {
						title: bookData.title || 'Unknown',
						subtitle: bookData.subtitle,
						author: bookData.author || [],
						isbn10: bookData.isbn10,
						isbn13: bookData.isbn13,
						publisher: bookData.publisher,
						publishDate: bookData.publishDate,
						totalPages: bookData.totalPages,
						coverUrl: bookData.coverUrl,
						category: bookData.category || [],
						status: validStatus,
						readPage: effectiveReadPage,
						readStarted: bookData.readStarted,
						readFinished: bookData.readFinished,
						created: bookData.created || new Date().toISOString(),
						updated: bookData.updated || new Date().toISOString(),
						lastReadDate, // From reading_history_summary in frontmatter
					};
				books.push({ book, file: vaultFile });
			}
		} catch (error) {
			console.error(`[Bookshelf] Error extracting book from Bases data:`, error);
		}
		}

		return books;
	}

	/**
	 * Render the view (abstract method to be implemented by subclasses)
	 */
	abstract render(): Promise<void> | void;


	/**
	 * Render error state
	 */
	protected renderError(error: Error): void {
		if (!this.rootElement) return;

		const doc = this.rootElement.ownerDocument;
		this.rootElement.empty();

	const errorEl = doc.createElement("div");
	errorEl.className = "bookshelf-error";
	errorEl.setCssProps({
		padding: "20px",
		"text-align": "center",
		color: "var(--text-error)"
	});
	errorEl.textContent = `Error: ${error.message}`;
	this.rootElement.appendChild(errorEl);
	}

	/**
	 * Lifecycle: Save ephemeral state (scroll position, etc).
	 */
	getEphemeralState(): unknown {
		return {
			scrollTop: this.rootElement?.scrollTop || 0,
		};
	}

	/**
	 * Lifecycle: Restore ephemeral state.
	 */
	setEphemeralState(state: unknown): void {
		if (!state || !this.rootElement || !this.rootElement.isConnected) return;

		try {
			const s = state as { scrollTop?: number };
			if (s.scrollTop !== undefined) {
				this.rootElement.scrollTop = s.scrollTop;
			}
		} catch (e) {
			console.debug("[Bookshelf][Bases] Failed to restore ephemeral state:", e);
		}
	}

	/**
	 * Lifecycle: Focus this view.
	 * Called by Bases when the view should receive focus.
	 */
	focus(): void {
		try {
			if (this.rootElement?.isConnected && typeof this.rootElement.focus === "function") {
				this.rootElement.focus();
			}
		} catch (e) {
			console.debug("[Bookshelf][Bases] Failed to focus view:", e);
		}
	}

	/**
	 * Lifecycle: Refresh/re-render the view.
	 */
	refresh(): void {
		this.render();
	}

	/**
	 * Lifecycle: Handle view resize.
	 * Called by Bases when the view container is resized.
	 */
	onResize(): void {
		// Default implementation does nothing
		// Subclasses can override if they need resize handling
	}

	/**
	 * View type identifier (to be set by subclasses)
	 */
	abstract get type(): string;
}
