/**
 * Date utility functions
 */

/**
 * Format date according to the given format string
 * @param date Date object or date string
 * @param format Format string (e.g., "YYYY-MM-DD HH:mm:ss")
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, format: string): string {
	const d = typeof date === 'string' ? new Date(date) : date;

	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');
	const seconds = String(d.getSeconds()).padStart(2, '0');

	return format
		.replace(/YYYY/g, String(year))
		.replace(/MM/g, month)
		.replace(/DD/g, day)
		.replace(/HH/g, hours)
		.replace(/mm/g, minutes)
		.replace(/ss/g, seconds);
}

/**
 * Get current date/time formatted string
 * @param format Format string (default: "YYYY-MM-DD HH:mm:ss")
 * @returns Formatted current date/time string
 */
export function getCurrentDateTime(format: string = 'YYYY-MM-DD HH:mm:ss'): string {
	return formatDate(new Date(), format);
}

/**
 * Get current date formatted string
 * @param format Format string (default: "YYYY-MM-DD")
 * @returns Formatted current date string
 */
export function getCurrentDate(format: string = 'YYYY-MM-DD'): string {
	return formatDate(new Date(), format);
}
