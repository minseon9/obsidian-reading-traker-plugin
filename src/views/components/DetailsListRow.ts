/**
 * Details List Row Component
 * Single row for time-based stats (year/month label, change, books/pages, reading days)
 */
export class DetailsListRow {
	static create(
		doc: Document,
		options: {
			label: string;
			changeText?: string;
			changeColor?: string;
			rightPrimary: string;
			rightSecondary: string;
		}
	): HTMLElement {
		const item = doc.createElement('div');
		item.setCssProps({
			display: "flex",
			"justify-content": "space-between",
			"align-items": "center",
			padding: "8px 0",
			"border-bottom": "1px solid var(--background-modifier-border)"
		});

		const leftContainer = doc.createElement('div');
		leftContainer.setCssProps({
			display: "flex",
			"flex-direction": "column",
			gap: "4px"
		});

		const label = doc.createElement('span');
		label.textContent = options.label;
		label.setCssProps({
			"font-size": "14px",
			"font-weight": "600"
		});
		leftContainer.appendChild(label);

		if (options.changeText !== undefined) {
			const changeEl = doc.createElement('span');
			changeEl.textContent = options.changeText;
			changeEl.setCssProps({
				"font-size": "11px",
				color: options.changeColor ?? "var(--text-muted)"
			});
			leftContainer.appendChild(changeEl);
		}

		const rightContainer = doc.createElement('div');
		rightContainer.setCssProps({
			display: "flex",
			"flex-direction": "column",
			gap: "2px",
			"align-items": "flex-end"
		});

		const primary = doc.createElement('span');
		primary.textContent = options.rightPrimary;
		primary.setCssProps({
			"font-size": "14px",
			color: "var(--text-muted)"
		});

		const secondary = doc.createElement('span');
		secondary.textContent = options.rightSecondary;
		secondary.setCssProps({
			"font-size": "11px",
			color: "var(--text-faint)"
		});

		rightContainer.appendChild(primary);
		rightContainer.appendChild(secondary);
		item.appendChild(leftContainer);
		item.appendChild(rightContainer);

		return item;
	}
}
