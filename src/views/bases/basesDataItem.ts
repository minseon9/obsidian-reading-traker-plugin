export interface BasesFileData {
	path: string;
	name?: string;
	ctime?: number;
	mtime?: number;
	[key: string]: unknown;
}

export interface BasesEntryData {
	file: BasesFileData;
	note?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface BasesDataItem {
	key: string;
	data: BasesEntryData;
	file: BasesFileData;
	path: string;
	properties: Record<string, unknown>;
	basesData: BasesEntryData;
}
