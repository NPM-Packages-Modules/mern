import { describe, expect, it } from "vitest"; import express from "express"; import request from "supertest"; import { routeblocks } from "./index.js";
it("rb", async ()=>{ const app=express(); const r=routeblocks().auth((_q,_r,n)=>n()).build(x=>{x.get("/",(_q,res)=>res.json({ok:1}))}); app.use(r);
expect((await request(app).get("/")).body.ok).toBe(1); });
