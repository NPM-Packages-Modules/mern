import { describe, expect, it } from "vitest"; import express from "express"; import request from "supertest"; import { z } from "zod"; import { pipeguardBody } from "./index.js";
it("p", async ()=>{ const app=express(); app.use(express.json()); app.post("/", pipeguardBody(z.object({x:z.number()})), (req,res)=>res.json(req.body));
const ok=await request(app).post("/").send({x:1}); expect(ok.body.x).toBe(1); });
