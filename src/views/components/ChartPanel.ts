/**
 * Chart Panel Component
 * Wraps a chart with consistent padding, background and title
 */
export class ChartPanel {
	/**
	 * Create a chart panel: container with title and a child div for the chart
	 */
	static create(
		doc: Document,
		title: string
	): { container: HTMLElement; chartEl: HTMLElement } {
		const container = doc.createElement('div');
		container.setCssProps({
			padding: "16px",
			background: "var(--background-secondary)",
			"border-radius": "8px",
			border: "1px solid var(--background-modifier-border)",
			minWidth: "0" // allow grid item to shrink with page width
		});

		const titleEl = doc.createElement('h3');
		titleEl.textContent = title;
		titleEl.setCssProps({
			margin: "0 0 12px 0",
			"font-size": "0.9em",
			color: "var(--text-muted)"
		});
		container.appendChild(titleEl);

		const chartEl = doc.createElement('div');
		chartEl.setCssProps({
			height: "200px",
			position: "relative",
			width: "100%",
			minWidth: "0" // allow chart to shrink so SVG viewBox can scale
		});
		container.appendChild(chartEl);

		return { container, chartEl };
	}

	/**
	 * Create a details list panel with title
	 */
	static createDetailsPanel(
		doc: Document,
		title: string
	): { container: HTMLElement; listEl: HTMLElement } {
		const container = doc.createElement('div');
		container.setCssProps({
			padding: "16px",
			background: "var(--background-secondary)",
			"border-radius": "8px",
			border: "1px solid var(--background-modifier-border)"
		});

		const titleEl = doc.createElement('h3');
		titleEl.textContent = title;
		titleEl.setCssProps({
			margin: "0 0 12px 0",
			"font-size": "0.9em",
			color: "var(--text-muted)"
		});
		container.appendChild(titleEl);

		const listEl = doc.createElement('div');
		container.appendChild(listEl);

		return { container, listEl };
	}
}
