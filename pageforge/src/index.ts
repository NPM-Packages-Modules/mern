export interface CP { id: string; sort: string }
export const pageforgeEncodeCursor = (p: CP) => Buffer.from(JSON.stringify(p),"utf8").toString("base64url");
export const pageforgeDecodeCursor = (s: string): CP|null => { try { return JSON.parse(Buffer.from(s,"base64url").toString("utf8")); } catch { return null; } };
export const pageforgeOffset = (page: number, limit: number) => { const p=Math.max(1,page), l=Math.max(1,limit); return { skip:(p-1)*l, limit:l }; };
