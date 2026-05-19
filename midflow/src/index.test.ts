import { describe, expect, it } from "vitest"; import express from "express"; import request from "supertest"; import { midflow } from "./index.js";
it("m", async ()=>{ const app=express(); let n=0; app.get("/", midflow((_q,_r,nx)=>{n++;nx();},(_q,res)=>res.json({n}))); expect((await request(app).get("/")).body.n).toBe(1); });
