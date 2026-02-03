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
		plugins: { obsidianmd },
		rules: {
			// Relax some strict rules for better developer experience
			"no-case-declarations": "warn",
			"no-empty": "warn",
			"no-undef": "warn",
			"no-constant-condition": "warn",
			// Allow UTC, EST, ISBN in UI strings (plugin default acronyms + ours)
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					acronyms: [
						"API", "HTTP", "HTTPS", "URL", "DNS", "TCP", "IP", "SSH", "TLS", "SSL",
						"FTP", "SFTP", "SMTP", "JSON", "XML", "HTML", "CSS", "PDF", "CSV", "YAML",
						"SQL", "PNG", "JPG", "JPEG", "GIF", "SVG", "2FA", "MFA", "OAuth", "JWT",
						"LDAP", "SAML", "SDK", "IDE", "CLI", "GUI", "CRUD", "REST", "SOAP",
						"CPU", "GPU", "RAM", "SSD", "USB", "UI", "OK", "RSS", "S3", "WebDAV",
						"ID", "UUID", "GUID", "SHA", "MD5", "ASCII", "UTF-8", "UTF-16", "DOM",
						"CDN", "FAQ", "AI", "ML",
						"UTC", "EST", "ISBN",
					],
					ignoreWords: ["Korea"],
				},
			],
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
