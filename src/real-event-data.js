(function () {
const eventModelBuilder = globalThis.EventModelBuilder || {};
const buildEventModelFromSnapshot = eventModelBuilder.buildEventModelFromSnapshot || ((snapshot) => snapshot);

const snapshots = Array.isArray(globalThis.realEventSnapshots?.events) ? globalThis.realEventSnapshots.events : [];
globalThis.eventCatalog = snapshots.map(buildEventModelFromSnapshot);
})();
