import { describe, expect, it } from "vitest"; import express from "express"; import request from "supertest"; import { apilifecycleDeprecation, apilifecycleVersionGate } from "./index.js";
it("a", async ()=>{ const app=express(); app.get("/d", apilifecycleDeprecation("Wed, 11 Nov 2026 00:00:00 GMT"), (_q,res)=>res.send("x"));
const h=await request(app).get("/d"); expect(h.headers.deprecation).toBe("true");
app.get("/v", apilifecycleVersionGate("2", ()=>"1"), (_q,res)=>res.send("ok")); expect((await request(app).get("/v")).status).toBe(426); });
