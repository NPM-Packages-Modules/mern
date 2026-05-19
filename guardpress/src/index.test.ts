import { describe, expect, it } from "vitest"; import express from "express"; import request from "supertest"; import { guardpress, guardRole } from "./index.js";
it("g", async () => { const app=express();
app.get("/b", guardpress(async()=>false), (_q,res)=>res.send("x")); expect((await request(app).get("/b")).status).toBe(403);
app.get("/o", guardpress(guardRole(()=>"admin", new Set(["admin"]))), (_q,res)=>res.send("ok")); expect((await request(app).get("/o")).status).toBe(200); });
