export function generateSdkSnippet(baseUrl: string, paths: string[]): string {
  return paths.map((p) => "export async function api_" + p.replace(/[^a-zA-Z0-9]+/g, "_") + "(init?: RequestInit) { return fetch(new URL('" + p + "', '" + baseUrl + "'), init); }").join("\n");
}