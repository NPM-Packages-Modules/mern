import { describe, expect, it } from "vitest"; import { serviceForge } from "./index.js";
it("s", async () => { const l: string[] = []; await serviceForge<{id:string}>("U",{beforeCreate:()=>l.push("b"),afterCreate:()=>l.push("a")}).create({id:"1"}); expect(l).toEqual(["b","a"]); });
