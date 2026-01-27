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
				throw new HttpError(
					`HTTP error! status: ${response.status}`,
					response.status,
					response.statusText
				);
			}

			return response;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof HttpError) {
				throw error;
			}

			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Request timeout after ${this.timeout}ms`);
			}

			if (error instanceof Error) {
				throw new Error(`Request failed: ${error.message}`);
			}

			throw error;
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
			if (error instanceof Error) {
				throw new Error(`Failed to parse JSON response: ${error.message}`);
			}
			throw error;
		}
	}
}

/**
 * HTTP error class
 */
export class HttpError extends Error {
	status: number;
	statusText: string;

	constructor(message: string, status: number, statusText: string) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.statusText = statusText;
	}
}
