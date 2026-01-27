/**
 * HTTP client for making requests with timeout and error handling
 */
export class HttpClient {
	private timeout: number;

	constructor(timeout: number = 5000) {
		this.timeout = timeout;
	}

	/**
	 * Make HTTP request with timeout
	 * @param url Request URL
	 * @param options Fetch options
	 * @returns Response object
	 * @throws Error if request fails or times out
	 */
	async fetch(url: string, options: RequestInit = {}): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			// Check if response is ok, throw error if not
			if (!response.ok) {
				throw new Error(`Request failed. Please try again later.`);
			}

			return response;
		} catch (error) {
			clearTimeout(timeoutId);
			throw new Error(`Request failed. Please try again later.`);
		}
	}

	/**
	 * Make GET request and parse JSON response
	 * @param url Request URL
	 * @param options Fetch options
	 * @returns Parsed JSON data
	 * @throws Error if request fails or response is not valid JSON
	 */
	async get<T>(url: string, options: RequestInit = {}): Promise<T> {
		const response = await this.fetch(url, {
			...options,
			method: 'GET',
		});

		try {
			return await response.json();
		} catch (error) {
			throw new Error(`Request failed. Please try again later.`);
		}
	}
}
