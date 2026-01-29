import { stringify as stringifyYaml } from 'yaml';
import { Frontmatter } from './types';

export class FrontmatterCreator {
	static create(data: Frontmatter): string {
		const yamlData: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(data)) {
			if (value === undefined || value === null) continue;
			if (key === 'reading_history') continue;

			if (value === '') {
				if (key === 'title' || key === 'author' || key === 'status') {
					yamlData[key] = value;
				}
				continue;
			}

			if (Array.isArray(value)) {
				if (value.length === 0) {
					if (key === 'reading_history_summary') {
						yamlData[key] = [];
					}
					continue;
				}

				if (key === 'reading_history_summary') {
					const validItems = value.filter((item) => 
						item && typeof item === 'object' && !Array.isArray(item)
					);
					yamlData[key] = validItems.length > 0 ? validItems : [];
				} else {
					yamlData[key] = value;
				}
			} else {
				yamlData[key] = value;
			}
		}

		try {
			const yamlString = stringifyYaml(yamlData, {
				lineWidth: 0,
				defaultStringType: 'QUOTE_DOUBLE',
				defaultKeyType: 'PLAIN',
			});
			return `---\n${yamlString}---`;
		} catch (error) {
			console.error('[FrontmatterCreator] Error creating YAML:', error);
			return '---\n---';
		}
	}
}
