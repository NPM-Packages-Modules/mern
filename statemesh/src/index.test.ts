import { describe, expect, it } from "vitest"; import { statemesh } from "./index.js";
it("s", async ()=>{ type S="a"|"b"; type E="go"; const m=statemesh<S,E>({initial:"a",transitions:{a:{go:"b"},b:{}}}); await m.send("go"); expect(m.state).toBe("b"); });
