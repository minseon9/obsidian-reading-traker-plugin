import { TFile } from 'obsidian';
import { Book } from '../../models/book';
import { BasesViewBase } from './base';
import { BookStatistics } from './bookStatistics';
import BookshelfPlugin from '../../main';

/**
 * Statistics View - Displays reading statistics and graphs
 */
export class StatisticsBasesView extends BasesViewBase {
	type = "bookshelfStatisticsView";

	private books: Array<{ book: Book; file: TFile }> = [];
	private stats: BookStatistics | null = null;

	constructor(controller: any, containerEl: HTMLElement, plugin: BookshelfPlugin) {
		super(controller, containerEl, plugin);
	}

	async render(): Promise<void> {
		if (!this.rootElement || !this.data?.data) return;

		try {
			const dataItems = this.extractDataItems();
			this.books = await this.extractBooksFromBasesData(dataItems);
			this.stats = await this.calculateStatistics();

			this.rootElement.empty();
			this.renderContent();
		} catch (error) {
			console.error('[Bookshelf][StatisticsView] Render error:', error);
			this.renderError(error as Error);
		}
	}

	private async calculateStatistics(): Promise<BookStatistics> {
		const stats: BookStatistics = {
			totalBooks: this.books.length,
			reading: 0,
			unread: 0,
			finished: 0,
			totalPages: 0,
			readPages: 0,
			averageTimeToFinish: 0,
			categoryCounts: {},
			yearlyStats: {},
			monthlyStats: {},
			readingDays: 0,
		};

		const finishedBooks: Book[] = [];
		const readingDaysSet = new Set<string>();

		for (const { book, file } of this.books) {
			// Count by status
			if (book.status === 'reading') stats.reading++;
			else if (book.status === 'unread') stats.unread++;
			else if (book.status === 'finished') {
				stats.finished++;
				finishedBooks.push(book);
			}

			// Pages
			if (book.totalPages) stats.totalPages += book.totalPages;
			if (book.readPage) stats.readPages += book.readPage;

			// Categories
			if (book.category && book.category.length > 0) {
				book.category.forEach((cat: string) => {
					stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + 1;
				});
			}

			// Finished books statistics
			if (book.status === 'finished' && book.readFinished) {
				const finishedDate = new Date(book.readFinished);
				const year = finishedDate.getFullYear().toString();
				const month = `${year}-${String(finishedDate.getMonth() + 1).padStart(2, '0')}`;

				if (!stats.yearlyStats[year]) {
					stats.yearlyStats[year] = { count: 0, pages: 0 };
				}
				stats.yearlyStats[year].count++;
				if (book.totalPages) {
					stats.yearlyStats[year].pages += book.totalPages;
				}

				if (!stats.monthlyStats[month]) {
					stats.monthlyStats[month] = { count: 0, pages: 0 };
				}
				stats.monthlyStats[month].count++;
				if (book.totalPages) {
					stats.monthlyStats[month].pages += book.totalPages;
				}
			}

			// Reading days calculation: only days with update progress (from reading_history_summary)
			// and the day reading started
			if (book.readStarted && file) {
				// Add the day reading started
				const startDate = new Date(book.readStarted);
				const startDateStr = startDate.toISOString().split('T')[0];
				if (startDateStr) {
					readingDaysSet.add(startDateStr);
				}

				// Add days from reading_history_summary (update progress days)
				// Get reading history summary from file
				try {
					const content = await this.plugin.app.vault.read(file);
					const { FrontmatterParser } = await import('../../services/frontmatterService/frontmatterParser');
					const { frontmatter } = FrontmatterParser.extract(content);
					
					const historySummary = frontmatter.reading_history_summary;
					if (historySummary && Array.isArray(historySummary)) {
						historySummary.forEach((record: any) => {
							if (record.date) {
								readingDaysSet.add(record.date);
							}
						});
					}
				} catch (e) {
					// Ignore errors
				}
			}
		}

		stats.readingDays = readingDaysSet.size;

		// Calculate changes (variation) for yearly stats
		const sortedYears = Object.keys(stats.yearlyStats).sort();
		for (let i = 1; i < sortedYears.length; i++) {
			const currentYear = sortedYears[i];
			const previousYear = sortedYears[i - 1];
			if (!currentYear || !previousYear) continue;
			
			const current = stats.yearlyStats[currentYear];
			const previous = stats.yearlyStats[previousYear];
			
			if (current && previous) {
				current.change = current.count - previous.count;
				current.changePercent = previous.count > 0 
					? Math.round((current.change / previous.count) * 100) 
					: (current.count > 0 ? 100 : 0);
			}
		}

		// Calculate changes (variation) for monthly stats
		const sortedMonths = Object.keys(stats.monthlyStats).sort();
		for (let i = 1; i < sortedMonths.length; i++) {
			const currentMonth = sortedMonths[i];
			const previousMonth = sortedMonths[i - 1];
			if (!currentMonth || !previousMonth) continue;
			
			const current = stats.monthlyStats[currentMonth];
			const previous = stats.monthlyStats[previousMonth];
			
			if (current && previous) {
				current.change = current.count - previous.count;
				current.changePercent = previous.count > 0 
					? Math.round((current.change / previous.count) * 100) 
					: (current.count > 0 ? 100 : 0);
			}
		}

		// Average time to finish
		if (finishedBooks.length > 0) {
			let totalDays = 0;
			let count = 0;
			for (const book of finishedBooks) {
				if (book.readStarted && book.readFinished) {
					const start = new Date(book.readStarted);
					const end = new Date(book.readFinished);
					const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
					totalDays += days;
					count++;
				}
			}
			stats.averageTimeToFinish = count > 0 ? Math.round(totalDays / count) : 0;
		}

		return stats;
	}

	private renderContent(): void {
		if (!this.rootElement || !this.stats) return;

		const doc = this.rootElement.ownerDocument;
		const container = doc.createElement('div');
		container.style.cssText = 'padding: 20px; overflow-y: auto; height: 100%;';

		// Title
		const title = doc.createElement('h1');
		title.textContent = 'Reading Statistics';
		title.style.cssText = 'margin: 0 0 24px 0; font-size: 1.8em;';
		container.appendChild(title);

		// Overview cards
		this.renderOverviewCards(container, doc);

		// Average time to finish
		this.renderAverageTime(container, doc);

		// Category breakdown
		this.renderCategoryBreakdown(container, doc);

		// Yearly statistics
		this.renderYearlyStats(container, doc);

		// Monthly statistics
		this.renderMonthlyStats(container, doc);

		// Reading days
		this.renderReadingDays(container, doc);

		this.rootElement.appendChild(container);
	}

	private renderOverviewCards(container: HTMLElement, doc: Document): void {
		const cardsContainer = doc.createElement('div');
		cardsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;';

		const cards = [
			{ label: 'Total Books', value: this.stats!.totalBooks, color: 'var(--text-normal)' },
			{ label: 'Reading', value: this.stats!.reading, color: 'var(--interactive-accent)' },
			{ label: 'Unread', value: this.stats!.unread, color: 'var(--text-muted)' },
			{ label: 'Finished', value: this.stats!.finished, color: 'var(--interactive-success)' },
			{ label: 'Total Pages', value: this.stats!.totalPages.toLocaleString(), color: 'var(--text-normal)' },
			{ label: 'Pages Read', value: this.stats!.readPages.toLocaleString(), color: 'var(--interactive-accent)' },
		];

		cards.forEach(card => {
			const cardEl = doc.createElement('div');
			cardEl.style.cssText = 'padding: 16px; border-radius: 8px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border);';

			const label = doc.createElement('div');
			label.textContent = card.label;
			label.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 8px;';

			const value = doc.createElement('div');
			value.textContent = card.value.toString();
			value.style.cssText = `font-size: 24px; font-weight: 600; color: ${card.color};`;

			cardEl.appendChild(label);
			cardEl.appendChild(value);
			cardsContainer.appendChild(cardEl);
		});

		container.appendChild(cardsContainer);
	}

	private renderAverageTime(container: HTMLElement, doc: Document): void {
		const section = doc.createElement('div');
		section.style.cssText = 'margin-bottom: 24px; padding: 16px; background: var(--background-secondary); border-radius: 8px;';

		const title = doc.createElement('h2');
		title.textContent = 'Average Time to Finish';
		title.style.cssText = 'margin: 0 0 12px 0; font-size: 1.2em;';

		const value = doc.createElement('div');
		value.textContent = this.stats!.averageTimeToFinish > 0 
			? `${this.stats!.averageTimeToFinish} days`
			: 'No data available';
		value.style.cssText = 'font-size: 32px; font-weight: 600; color: var(--interactive-accent);';

		section.appendChild(title);
		section.appendChild(value);
		container.appendChild(section);
	}

	private renderCategoryBreakdown(container: HTMLElement, doc: Document): void {
		const categories = Object.entries(this.stats!.categoryCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		if (categories.length === 0) return;

		const section = doc.createElement('div');
		section.style.cssText = 'margin-bottom: 24px; padding: 16px; background: var(--background-secondary); border-radius: 8px;';

		const title = doc.createElement('h2');
		title.textContent = 'Books by Category';
		title.style.cssText = 'margin: 0 0 16px 0; font-size: 1.2em;';

		const list = doc.createElement('div');
		categories.forEach(([category, count]) => {
			const item = doc.createElement('div');
			item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--background-modifier-border);';

			const label = doc.createElement('span');
			label.textContent = category;
			label.style.cssText = 'font-size: 14px;';

			const value = doc.createElement('span');
			value.textContent = count.toString();
			value.style.cssText = 'font-weight: 600; color: var(--interactive-accent);';

			item.appendChild(label);
			item.appendChild(value);
			list.appendChild(item);
		});

		section.appendChild(title);
		section.appendChild(list);
		container.appendChild(section);
	}

	private renderYearlyStats(container: HTMLElement, doc: Document): void {
		const years = Object.keys(this.stats!.yearlyStats).sort().reverse();
		if (years.length === 0) return;

		const section = doc.createElement('div');
		section.style.cssText = 'margin-bottom: 24px; padding: 16px; background: var(--background-secondary); border-radius: 8px;';

		const title = doc.createElement('h2');
		title.textContent = 'Books Finished by Year';
		title.style.cssText = 'margin: 0 0 16px 0; font-size: 1.2em;';

		// Chart container with line chart showing variation
		const chartContainer = doc.createElement('div');
		chartContainer.style.cssText = 'margin-bottom: 16px; height: 250px; position: relative;';
		this.renderLineChart(chartContainer, doc, years.map(year => {
			const stat = this.stats!.yearlyStats[year];
			return {
				label: year,
				value: stat ? stat.count : 0,
				change: stat?.change,
				changePercent: stat?.changePercent,
			};
		}), 'Year');

		// Bar chart for comparison
		const barChartContainer = doc.createElement('div');
		barChartContainer.style.cssText = 'margin-bottom: 16px; height: 200px; position: relative;';
		this.renderBarChart(barChartContainer, doc, years.map(year => {
			const stat = this.stats!.yearlyStats[year];
			return {
				label: year,
				value: stat ? stat.count : 0,
			};
		}));

		const list = doc.createElement('div');
		years.forEach(year => {
			const stat = this.stats!.yearlyStats[year];
			if (!stat) return;
			
			const item = doc.createElement('div');
			item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--background-modifier-border);';

			const leftContainer = doc.createElement('div');
			leftContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

			const label = doc.createElement('span');
			label.textContent = year;
			label.style.cssText = 'font-size: 14px; font-weight: 600;';

			// Show change if available
			if (stat.change !== undefined && stat.changePercent !== undefined) {
				const changeEl = doc.createElement('span');
				const isPositive = stat.change >= 0;
				const changeText = isPositive ? `+${stat.change}` : `${stat.change}`;
				const percentText = isPositive ? `+${stat.changePercent}%` : `${stat.changePercent}%`;
				changeEl.textContent = `${changeText} (${percentText})`;
				changeEl.style.cssText = `font-size: 11px; color: ${isPositive ? 'var(--interactive-success)' : 'var(--text-error)'};`;
				leftContainer.appendChild(changeEl);
			}

			const value = doc.createElement('span');
			value.textContent = `${stat.count} books, ${stat.pages.toLocaleString()} pages`;
			value.style.cssText = 'font-size: 14px; color: var(--text-muted);';

			item.appendChild(leftContainer);
			item.appendChild(value);
			list.appendChild(item);
		});

		section.appendChild(title);
		section.appendChild(chartContainer);
		section.appendChild(barChartContainer);
		section.appendChild(list);
		container.appendChild(section);
	}

	private renderMonthlyStats(container: HTMLElement, doc: Document): void {
		const months = Object.keys(this.stats!.monthlyStats).sort().reverse().slice(0, 12);
		if (months.length === 0) return;

		const section = doc.createElement('div');
		section.style.cssText = 'margin-bottom: 24px; padding: 16px; background: var(--background-secondary); border-radius: 8px;';

		const title = doc.createElement('h2');
		title.textContent = 'Books Finished by Month (Last 12)';
		title.style.cssText = 'margin: 0 0 16px 0; font-size: 1.2em;';

		// Chart container with line chart showing variation
		const chartContainer = doc.createElement('div');
		chartContainer.style.cssText = 'margin-bottom: 16px; height: 250px; position: relative;';
		this.renderLineChart(chartContainer, doc, months.map(month => {
			const stat = this.stats!.monthlyStats[month];
			// Format month label (e.g., "2026-01" -> "Jan 2026")
			const parts = month.split('-');
			const year = parts[0] || '';
			const monthNum = parts[1] || '1';
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const monthLabel = `${monthNames[parseInt(monthNum) - 1] || 'Jan'} ${year}`;
			return {
				label: monthLabel,
				value: stat ? stat.count : 0,
				change: stat?.change,
				changePercent: stat?.changePercent,
			};
		}), 'Month');

		// Bar chart for comparison
		const barChartContainer = doc.createElement('div');
		barChartContainer.style.cssText = 'margin-bottom: 16px; height: 200px; position: relative;';
		this.renderBarChart(barChartContainer, doc, months.map(month => {
			const stat = this.stats!.monthlyStats[month];
			const parts = month.split('-');
			const year = parts[0] || '';
			const monthNum = parts[1] || '1';
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const monthLabel = `${monthNames[parseInt(monthNum) - 1] || 'Jan'} ${year}`;
			return {
				label: monthLabel,
				value: stat ? stat.count : 0,
			};
		}));

		const list = doc.createElement('div');
		months.forEach(month => {
			const stat = this.stats!.monthlyStats[month];
			if (!stat) return;
			
			const parts = month.split('-');
			const year = parts[0] || '';
			const monthNum = parts[1] || '1';
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const monthLabel = `${monthNames[parseInt(monthNum) - 1] || 'Jan'} ${year}`;
			
			const item = doc.createElement('div');
			item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--background-modifier-border);';

			const leftContainer = doc.createElement('div');
			leftContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

			const label = doc.createElement('span');
			label.textContent = monthLabel;
			label.style.cssText = 'font-size: 14px; font-weight: 600;';

			// Show change if available
			if (stat.change !== undefined && stat.changePercent !== undefined) {
				const changeEl = doc.createElement('span');
				const isPositive = stat.change >= 0;
				const changeText = isPositive ? `+${stat.change}` : `${stat.change}`;
				const percentText = isPositive ? `+${stat.changePercent}%` : `${stat.changePercent}%`;
				changeEl.textContent = `${changeText} (${percentText})`;
				changeEl.style.cssText = `font-size: 11px; color: ${isPositive ? 'var(--interactive-success)' : 'var(--text-error)'};`;
				leftContainer.appendChild(changeEl);
			}

			const value = doc.createElement('span');
			value.textContent = `${stat.count} books, ${stat.pages.toLocaleString()} pages`;
			value.style.cssText = 'font-size: 14px; color: var(--text-muted);';

			item.appendChild(leftContainer);
			item.appendChild(value);
			list.appendChild(item);
		});

		section.appendChild(title);
		section.appendChild(chartContainer);
		section.appendChild(barChartContainer);
		section.appendChild(list);
		container.appendChild(section);
	}

	/**
	 * Render a simple bar chart
	 */
	private renderBarChart(container: HTMLElement, doc: Document, data: Array<{ label: string; value: number }>): void {
		if (data.length === 0) return;

		const maxValue = Math.max(...data.map(d => d.value), 1);
		const chartHeight = 180;
		const barWidth = Math.max(20, (container.clientWidth || 400) / data.length - 10);

		const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', `${chartHeight}px`);
		svg.style.cssText = 'display: block;';

		data.forEach((item, index) => {
			const barHeight = (item.value / maxValue) * (chartHeight - 40);
			const x = index * (barWidth + 10) + 5;
			const y = chartHeight - barHeight - 20;

			// Bar
			const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
			rect.setAttribute('x', x.toString());
			rect.setAttribute('y', y.toString());
			rect.setAttribute('width', barWidth.toString());
			rect.setAttribute('height', barHeight.toString());
			rect.setAttribute('fill', 'var(--interactive-accent)');
			rect.setAttribute('rx', '4');
			svg.appendChild(rect);

			// Value label on top of bar
			if (item.value > 0) {
				const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
				text.setAttribute('x', (x + barWidth / 2).toString());
				text.setAttribute('y', (y - 5).toString());
				text.setAttribute('text-anchor', 'middle');
				text.setAttribute('font-size', '12');
				text.setAttribute('fill', 'var(--text-normal)');
				text.textContent = item.value.toString();
				svg.appendChild(text);
			}

			// X-axis label
			const label = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
			label.setAttribute('x', (x + barWidth / 2).toString());
			label.setAttribute('y', (chartHeight - 5).toString());
			label.setAttribute('text-anchor', 'middle');
			label.setAttribute('font-size', '10');
			label.setAttribute('fill', 'var(--text-muted)');
			label.textContent = item.label.length > 7 ? item.label.substring(0, 7) + '...' : item.label;
			svg.appendChild(label);
		});

		container.appendChild(svg);
	}

	/**
	 * Render a line chart showing variation over time
	 */
	private renderLineChart(
		container: HTMLElement, 
		doc: Document, 
		data: Array<{ label: string; value: number; change?: number; changePercent?: number }>,
		xAxisLabel: string
	): void {
		if (data.length === 0) return;

		// Reverse data to show chronological order (oldest to newest)
		const reversedData = [...data].reverse();
		const maxValue = Math.max(...reversedData.map(d => d.value), 1);
		const chartHeight = 200;
		const chartWidth = container.clientWidth || 600;
		const padding = 40;
		const plotWidth = chartWidth - padding * 2;
		const plotHeight = chartHeight - padding * 2;

		const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', `${chartHeight}px`);
		svg.style.cssText = 'display: block;';

		// Calculate points for line
		const points: string[] = [];
		reversedData.forEach((item, index) => {
			const x = padding + (index / (reversedData.length - 1 || 1)) * plotWidth;
			const y = padding + plotHeight - (item.value / maxValue) * plotHeight;
			points.push(`${x},${y}`);
		});

		// Draw line
		if (points.length > 1) {
			const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', `M ${points.join(' L ')}`);
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', 'var(--interactive-accent)');
			path.setAttribute('stroke-width', '2');
			path.setAttribute('stroke-linecap', 'round');
			path.setAttribute('stroke-linejoin', 'round');
			svg.appendChild(path);
		}

		// Draw points and change indicators
		reversedData.forEach((item, index) => {
			const x = padding + (index / (reversedData.length - 1 || 1)) * plotWidth;
			const y = padding + plotHeight - (item.value / maxValue) * plotHeight;

			// Point circle
			const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', x.toString());
			circle.setAttribute('cy', y.toString());
			circle.setAttribute('r', '4');
			circle.setAttribute('fill', 'var(--interactive-accent)');
			svg.appendChild(circle);

			// Value label
			if (item.value > 0) {
				const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
				text.setAttribute('x', x.toString());
				text.setAttribute('y', (y - 10).toString());
				text.setAttribute('text-anchor', 'middle');
				text.setAttribute('font-size', '11');
				text.setAttribute('fill', 'var(--text-normal)');
				text.setAttribute('font-weight', '600');
				text.textContent = item.value.toString();
				svg.appendChild(text);
			}

			// Change indicator (arrow)
			if (item.change !== undefined && item.change !== 0) {
				const isPositive = item.change > 0;
				const arrowY = y - 20;
				const arrowPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
				if (isPositive) {
					// Up arrow
					arrowPath.setAttribute('d', `M ${x} ${arrowY} L ${x - 4} ${arrowY + 6} L ${x + 4} ${arrowY + 6} Z`);
				} else {
					// Down arrow
					arrowPath.setAttribute('d', `M ${x} ${arrowY + 6} L ${x - 4} ${arrowY} L ${x + 4} ${arrowY} Z`);
				}
				arrowPath.setAttribute('fill', isPositive ? 'var(--interactive-success)' : 'var(--text-error)');
				svg.appendChild(arrowPath);
			}

			// X-axis label
			const label = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
			label.setAttribute('x', x.toString());
			label.setAttribute('y', (chartHeight - 10).toString());
			label.setAttribute('text-anchor', 'middle');
			label.setAttribute('font-size', '9');
			label.setAttribute('fill', 'var(--text-muted)');
			label.textContent = item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label;
			svg.appendChild(label);
		});

		// Y-axis (value scale)
		const yAxisSteps = 5;
		for (let i = 0; i <= yAxisSteps; i++) {
			const value = (maxValue / yAxisSteps) * i;
			const y = padding + plotHeight - (i / yAxisSteps) * plotHeight;

			// Grid line
			const gridLine = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
			gridLine.setAttribute('x1', padding.toString());
			gridLine.setAttribute('y1', y.toString());
			gridLine.setAttribute('x2', (padding + plotWidth).toString());
			gridLine.setAttribute('y2', y.toString());
			gridLine.setAttribute('stroke', 'var(--background-modifier-border)');
			gridLine.setAttribute('stroke-width', '1');
			gridLine.setAttribute('stroke-dasharray', '2,2');
			svg.insertBefore(gridLine, svg.firstChild);

			// Y-axis label
			const yLabel = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
			yLabel.setAttribute('x', (padding - 5).toString());
			yLabel.setAttribute('y', (y + 4).toString());
			yLabel.setAttribute('text-anchor', 'end');
			yLabel.setAttribute('font-size', '9');
			yLabel.setAttribute('fill', 'var(--text-muted)');
			yLabel.textContent = Math.round(value).toString();
			svg.insertBefore(yLabel, svg.firstChild);
		}

		container.appendChild(svg);
	}

	private renderReadingDays(container: HTMLElement, doc: Document): void {
		const section = doc.createElement('div');
		section.style.cssText = 'margin-bottom: 24px; padding: 16px; background: var(--background-secondary); border-radius: 8px;';

		const title = doc.createElement('h2');
		title.textContent = 'Reading Days';
		title.style.cssText = 'margin: 0 0 12px 0; font-size: 1.2em;';

		const value = doc.createElement('div');
		value.textContent = `${this.stats!.readingDays} days`;
		value.style.cssText = 'font-size: 32px; font-weight: 600; color: var(--interactive-accent);';

		section.appendChild(title);
		section.appendChild(value);
		container.appendChild(section);
	}
}

