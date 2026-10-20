// Dev only: compile every page in the background right after `next dev` starts, so the first click on a page is fast.
// A placeholder session cookie gets past the middleware's cookie check (the real session check in the (app) layout still
// rejects it); [id] pages are compiled with a dummy id. Usage: node scripts/warmup.mjs [baseUrl]
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const base = process.argv[2] ?? "http://localhost:3001";
const appDir = join(import.meta.dirname, "..", "app");

function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name.startsWith("_") || name === "api" ? [] : pages(p);
    return name === "page.tsx" ? [p] : [];
  });
}
const routes = pages(appDir)
  .map((p) => "/" + relative(appDir, p).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)).map((s) => (s.startsWith("[") ? "warmup" : s)).join("/"))
  // the dashboard and lists first: what staff open first
  .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));

const get = (path) => fetch(base + path, { redirect: "manual", headers: { cookie: "better-auth.session_token=warmup" }, signal: AbortSignal.timeout(600_000) });

for (let i = 0; ; i++) {
  try {
    await get("/admin/login");
    break;
  } catch {
    if (i > 300) process.exit(1);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
const started = Date.now();
for (const [i, path] of routes.entries()) {
  const t = Date.now();
  const status = await get(path).then((r) => r.status, (e) => e.message);
  console.log(`[warmup ${i + 1}/${routes.length}] ${path} ${status} ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
console.log(`[warmup] all ${routes.length} pages compiled in ${Math.round((Date.now() - started) / 1000)}s`);
