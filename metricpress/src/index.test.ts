import { describe, expect, it } from "vitest"; import express from "express"; import request from "supertest"; import { metricpress, metricpressReset, metricpressSnapshot } from "./index.js";
it("m", async ()=>{ metricpressReset(); const app=express(); app.get("/", metricpress(), (_q,res)=>res.send("x"));
await request(app).get("/"); const s=metricpressSnapshot(); expect(Object.keys(s).length).toBeGreaterThan(0); });
