/**
 * Toggle Button Group Component
 * Two-button toggle (e.g. Yearly / Monthly)
 */
const ACTIVE_BUTTON_STYLE = {
	padding: "6px 16px",
	border: "none",
	"border-radius": "4px",
	background: "var(--interactive-accent)",
	color: "var(--text-on-accent)",
	"font-size": "13px",
	"font-weight": "600",
	cursor: "pointer"
};

const INACTIVE_BUTTON_STYLE = {
	padding: "6px 16px",
	border: "none",
	"border-radius": "4px",
	background: "transparent",
	color: "var(--text-muted)",
	"font-size": "13px",
	"font-weight": "600",
	cursor: "pointer"
};

export class ToggleButtonGroup {
	/**
	 * Create a two-option toggle. Returns { container, yearButton, monthButton }.
	 * Call setActive('year'|'month') to update styles.
	 */
	static create(
		doc: Document,
		yearLabel: string,
		monthLabel: string
	): {
		container: HTMLElement;
		yearButton: HTMLButtonElement;
		monthButton: HTMLButtonElement;
		setActive: (which: 'year' | 'month') => void;
	} {
		const container = doc.createElement('div');
		container.setCssProps({
			display: "flex",
			gap: "4px",
			background: "var(--background-secondary)",
			"border-radius": "6px",
			padding: "4px"
		});

		const yearButton = doc.createElement('button');
		yearButton.textContent = yearLabel;
		yearButton.setCssProps(ACTIVE_BUTTON_STYLE);

		const monthButton = doc.createElement('button');
		monthButton.textContent = monthLabel;
		monthButton.setCssProps(INACTIVE_BUTTON_STYLE);

		container.appendChild(yearButton);
		container.appendChild(monthButton);

		const setActive = (which: 'year' | 'month') => {
			if (which === 'year') {
				yearButton.setCssProps(ACTIVE_BUTTON_STYLE);
				monthButton.setCssProps(INACTIVE_BUTTON_STYLE);
			} else {
				monthButton.setCssProps(ACTIVE_BUTTON_STYLE);
				yearButton.setCssProps(INACTIVE_BUTTON_STYLE);
			}
		};

		return { container, yearButton, monthButton, setActive };
	}
}
