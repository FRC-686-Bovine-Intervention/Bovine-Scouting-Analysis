import process from "node:process";
import http from "node:http";
import { createRecorderService, loadRecorderConfig } from "./recording.mjs";

function value(name, fallback = "") { return process.env[name] || fallback; }
const fileConfig = loadRecorderConfig();
const eventCodes = (process.argv.slice(2).filter((arg) => !arg.startsWith("--"))).concat(fileConfig.events || []).concat(value("EVENT_RECORDER_EVENTS").split(",").filter(Boolean));
if (!eventCodes.length) throw new Error("Provide an event code argument or EVENT_RECORDER_EVENTS.");
const outputRoot = value("EVENT_RECORDER_OUTPUT", fileConfig.outputRoot || "recordings");
const once = process.argv.includes("--once") || value("EVENT_RECORDER_ONCE") === "1";
const service = createRecorderService({
  events: eventCodes,
  recorderOptions: {
    outputRoot,
    tbaAuthKey: value("TBA_AUTH_KEY"),
    tbaBaseUrl: value("EVENT_RECORDER_TBA_URL", fileConfig.tbaBaseUrl || undefined),
    statboticsBaseUrl: value("EVENT_RECORDER_STATBOTICS_URL", fileConfig.statboticsBaseUrl || undefined),
    statboticsFallbackBaseUrl: value("EVENT_RECORDER_STATBOTICS_FALLBACK_URL", fileConfig.statboticsFallbackBaseUrl || undefined),
    pollIntervalsMs: fileConfig.pollIntervalsMs,
  },
});

const send = (res, status, value) => { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(value)); };
const statusPort = Number(value("EVENT_RECORDER_STATUS_PORT", fileConfig.statusPort || 8788));
const statusServer = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/status") return send(res, 200, service.status());
  if (req.method === "POST" && req.url === "/control/start") return send(res, 200, service.start());
  if (req.method === "POST" && req.url === "/control/stop") return send(res, 200, service.stop());
  if (req.method === "POST" && req.url === "/control/poll") return send(res, 200, await service.poll());
  return send(res, 404, { error: "not found" });
});

await service.poll();
if (once) process.exit(0);
statusServer.listen(statusPort, "127.0.0.1", () => console.log(`event recorder status: http://127.0.0.1:${statusPort}/status`));
service.start();
process.on("SIGINT", () => { service.stop(); statusServer.close(() => process.exit(0)); });
