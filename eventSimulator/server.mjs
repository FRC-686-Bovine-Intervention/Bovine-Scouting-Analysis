import http from "node:http";
import { createEngine } from "./engine.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const engine = createEngine({ root: path.resolve(here, ".."), statePath: process.env.EVENT_SIMULATOR_STATE || path.join(here, ".state.json") });
const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(value)); };
const body = async (req) => { let text = ""; for await (const chunk of req) text += chunk; return text ? JSON.parse(text) : {}; };

function route(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "state") return ["state"];
  if (parts[0] === "control") return ["control", ...parts.slice(1)];
  if (parts[0] === "api" && parts[1] === "tba" && parts[2] === "event") return ["tba", parts[4] || "event"];
  if ((parts[0] === "api" && parts[1] === "statbotics") || parts[0] === "statbotics") {
    const kind = parts.includes("team_events") || parts.includes("team-events") ? "team-events" : parts.includes("team_matches") || parts.includes("team-matches") ? "team-matches" : parts.includes("matches") ? "matches" : "event";
    return ["statbotics", kind];
  }
  if (parts[0] === "api" && parts[1] === "scouting") return ["scouting", "scouting"];
  return [];
}

export function createServer({ simulator = engine } = {}) { return http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
    const r = route(url.pathname);
    if (r[0] === "state") return json(res, 200, simulator.getState());
    if (r[0] === "control" && req.method === "POST") {
      const value = await body(req);
      const action = r[1];
      if (action === "advance") return json(res, 200, simulator.advance(value.amount));
      if (action === "set") return json(res, 200, simulator.setState(value));
      if (action === "reset-timeline") return json(res, 200, simulator.resetTimeline());
      if (action === "reset-config") return json(res, 200, simulator.resetConfig());
      if (action === "reset") return json(res, 200, simulator.resetAll());
    }
    if (r[0] && ["tba", "statbotics", "scouting"].includes(r[0])) {
      const source = r[0]; const kind = r[1]; const generation = simulator.requestGeneration?.(); const snapshot = simulator.get(source, kind);
      simulator.recordRequest({ source, kind, cursor: simulator.effectiveCursor(source), at: new Date().toISOString() }, generation);
      const delay = simulator.responseDelay(source); return setTimeout(() => json(res, 200, snapshot), delay);
    }
    if (url.pathname === "/" || url.pathname === "/control.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(fs.readFileSync(path.join(here, "control.html"))); }
    json(res, 404, { error: "not found" });
  } catch (error) { json(res, error.statusCode || 500, { error: error.message }); }
}); }
const port = Number(process.env.PORT || process.argv[2] || 8787);
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) createServer().listen(port, "127.0.0.1", () => console.log(`eventSimulator listening on http://127.0.0.1:${port}`));
