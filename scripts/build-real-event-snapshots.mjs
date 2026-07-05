import { realEventSourceConfig } from "./real-event-snapshot-config.mjs";
import { writeRealEventSnapshots } from "./real-event-snapshot-builder.mjs";

const { outputPath, snapshotData } = writeRealEventSnapshots(realEventSourceConfig);
console.log(`Wrote ${snapshotData.events.length} snapshot event(s) to ${outputPath}`);
