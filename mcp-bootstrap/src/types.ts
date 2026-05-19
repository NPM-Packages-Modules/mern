export type TemplateName = "blank" | "postgres" | "stripe" | "rest" | "filesystem";
export type Transport = "stdio" | "sse";
export type Language = "typescript" | "javascript";

export interface ScaffoldOptions {
  name: string;
  template: TemplateName;
  transport: Transport;
  language: Language;
  auth: boolean;
  /** Output directory; defaults to `<name>`. */
  target?: string;
}

export interface TemplateFile {
  path: string;
  contents: string;
}

export interface TemplateDescriptor {
  name: TemplateName;
  description: string;
  envVars: { name: string; description: string }[];
  files(opts: ScaffoldOptions): TemplateFile[];
}
