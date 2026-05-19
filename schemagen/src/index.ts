import type { ZodObject, ZodRawShape } from "zod";
export interface FieldSpec { key: string; zodType: string }
export function schemagenFields(s: ZodObject<ZodRawShape>): FieldSpec[] {
return Object.entries(s.shape).map(([k,z])=>({key:k,zodType:(z as { _def?: { typeName?: string } })._def?.typeName??"unknown"})); }
export function schemagenDtoInterface(s: ZodObject<ZodRawShape>, n="Dto") { const f=schemagenFields(s);
return "export interface "+n+" {\n"+f.map(x=>"  "+x.key+": unknown;").join("\n")+"\n}\n"; }
