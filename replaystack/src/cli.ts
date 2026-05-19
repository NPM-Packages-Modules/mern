import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pc from "picocolors";
import { parseCaptureList, replayAll } from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "replay" || !args[1]) {
    console.log(pc.cyan("replaystack"), "replay <captures.json> --base <http://localhost:3000>");
    process.exit(1);
  }
  let base = "http://127.0.0.1:3000";
  const bi = args.indexOf("--base");
  if (bi !== -1 && args[bi + 1]) base = args[bi + 1]!;
  const file = resolve(args[1]!);
  const raw = JSON.parse(await readFile(file, "utf8"));
  const caps = parseCaptureList(raw);
  const results = await replayAll(base, caps);
  for (const r of results) {
    console.log(pc.dim(r.cap.method), r.cap.url, r.status < 400 ? pc.green(String(r.status)) : pc.yellow(String(r.status)));
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
