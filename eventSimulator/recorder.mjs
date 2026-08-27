import process from "node:process";
import { createRecorder } from "./recording.mjs";

function value(name, fallback = "") { return process.env[name] || fallback; }
const eventCodes = (process.argv.slice(2).filter((arg) => !arg.startsWith("--"))).concat(value("EVENT_RECORDER_EVENTS").split(",").filter(Boolean));
if (!eventCodes.length) throw new Error("Provide an event code argument or EVENT_RECORDER_EVENTS.");
const outputRoot = value("EVENT_RECORDER_OUTPUT", "recordings");
const once = process.argv.includes("--once") || value("EVENT_RECORDER_ONCE") === "1";
const recorders = eventCodes.map((eventCode) => createRecorder({ eventCode, outputRoot, tbaAuthKey: value("TBA_AUTH_KEY") }));

async function poll() {
  for (const recorder of recorders) {
    const cursor = await recorder.poll({ force: false });
    const status = recorder.status();
    console.log(JSON.stringify({ eventCode: status.eventCode, cursor: cursor?.cursor ?? null, eventTag: cursor?.eventTag ?? null, directory: status.directory }));
  }
}

await poll();
if (!once) {
  const timer = setInterval(() => poll().catch((error) => console.error(error)), 1000);
  process.on("SIGINT", () => { clearInterval(timer); process.exit(0); });
}
