import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			// Relax some strict rules for better developer experience
			"no-case-declarations": "warn",
			"no-empty": "warn",
			"no-undef": "warn",
			"no-constant-condition": "warn",
		},
	},
	{
		ignores: [
			"node_modules/",
			"dist/",
			"main.js",
			"esbuild.config.mjs",
			"version-bump.mjs",
			"versions.json",
		],
	},
);
