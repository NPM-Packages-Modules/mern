import { describe, expect, it } from "vitest"; import { pageforgeDecodeCursor, pageforgeEncodeCursor, pageforgeOffset } from "./index.js";
it("p", () => { const x={id:"1",sort:"a"}; expect(pageforgeDecodeCursor(pageforgeEncodeCursor(x))).toEqual(x); expect(pageforgeOffset(2,10).skip).toBe(10); });
