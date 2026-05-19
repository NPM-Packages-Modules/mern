import { describe, expect, it } from "vitest"; import { generateSdkSnippet } from "./index.js";
it("sdk", () => expect(generateSdkSnippet("http://x/",["/u"])).toContain("/u"));
