import { parse as parseYaml } from 'yaml';
import { Frontmatter, ReadingHistorySummaryItem } from './types';

export class FrontmatterParser {
	static parse(content: string): Frontmatter {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
		const match = content.match(frontmatterRegex);

		if (!match || !match[1]) {
			return {};
		}

		const frontmatterText = match[1];

		try {
			const parsed = parseYaml(frontmatterText) as Record<string, unknown> | null;
			if (!parsed || typeof parsed !== 'object') {
				return {};
			}

			const frontmatter: Frontmatter = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (key === 'reading_history') continue;

				if (key === 'reading_history_summary') {
					frontmatter[key] = FrontmatterParser.normalizeReadingHistorySummary(value) as ReadingHistorySummaryItem[];
					continue;
				}

				if (value === '') {
					if (key === 'title' || key === 'status') {
						frontmatter[key] = value;
					} else if (key === 'author') {
						frontmatter[key] = [];
					}
					continue;
				}

				frontmatter[key] = value;
			}

			return frontmatter;
		} catch (error) {
			console.error('[FrontmatterParser] Error parsing YAML:', error);
			return {};
		}
	}

	static extract(content: string): { frontmatter: Frontmatter; body: string } {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			return { frontmatter: {}, body: content };
		}

		const frontmatter = FrontmatterParser.parse(content);
		const body = content.substring(match[0].length);

		return { frontmatter, body };
	}

	private static normalizeReadingHistorySummary(value: unknown): unknown[] {
		if (value === null || value === undefined || value === '') {
			return [];
		}
		if (Array.isArray(value)) {
			return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
		}
		return [];
	}
}
