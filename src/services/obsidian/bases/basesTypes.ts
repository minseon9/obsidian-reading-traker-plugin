export type ViewOption =
	| PropertyOption
	| DropdownOption
	| SliderOption
	| ToggleOption
	| TextOption
	| MultitextOption
	| GroupOption;

export interface PropertyOption {
	type: "property";
	key: string;
	displayName: string;
	default?: string;
	placeholder?: string;
	filter?: (prop: string) => boolean;
}

export interface DropdownOption {
	type: "dropdown";
	key: string;
	displayName: string;
	options: Record<string, string> | string[];
	default?: string;
}

export interface SliderOption {
	type: "slider";
	key: string;
	displayName: string;
	min: number;
	max: number;
	step: number;
	default?: number;
}

export interface ToggleOption {
	type: "toggle";
	key: string;
	displayName: string;
	default?: boolean;
}

export interface TextOption {
	type: "text";
	key: string;
	displayName: string;
	default?: string;
	placeholder?: string;
}

export interface MultitextOption {
	type: "multitext";
	key: string;
	displayName: string;
	default?: string;
	placeholder?: string;
}

export interface GroupOption {
	type: "group";
	displayName: string;
	items: ViewOption[];
}

export interface BasesViewRegistration {
	name: string;
	icon: string;
	factory: (controller: any, containerEl: HTMLElement) => any;
	options?: () => ViewOption[];
}

export interface BasesAPI {
	registrations: Record<string, BasesViewRegistration>;
	isEnabled: boolean;
	version?: string;
}
