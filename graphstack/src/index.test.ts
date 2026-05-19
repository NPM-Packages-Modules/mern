import { describe, expect, it } from "vitest";
import { graphstack } from "./index.js";

it("version", () => expect(graphstack.version).toBe("0.1.0"));
