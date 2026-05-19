import { describe, expect, it } from "vitest"; import { searchforgeEscapeRegex, searchforgeFuzzyClause } from "./index.js";
it("s", ()=>{ expect(searchforgeEscapeRegex("a+b")).toContain("\\+"); expect(searchforgeFuzzyClause("t","x").t).toBeDefined(); });
