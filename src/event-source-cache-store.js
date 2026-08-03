(function attachEventSourceCacheStore(globalScope) {
  const eventSourceCache = globalScope.EventSourceCache || {};

  function normalizeText(value) { return String(value ?? "").trim(); }
  function normalizeEventKey(value) { return normalizeText(value).toLowerCase(); }
  function sharedWorkspaceMetadata(workspace = {}) {
    const externalSources = Object.fromEntries(Object.entries(workspace?.sources || {})
      .filter(([sourceId]) => sourceId !== "scouting")
      .map(([sourceId, source]) => [sourceId, {
        status: normalizeText(source?.status), freshness: normalizeText(source?.freshness),
        sourceFingerprint: normalizeText(source?.sourceFingerprint), lastSuccessfulAt: normalizeText(source?.lastSuccessfulAt),
      }]));
    const scouting = Array.isArray(workspace?.sources?.scouting) ? workspace.sources.scouting.map((attachment) => ({
      attachmentId: normalizeText(attachment?.attachmentId), label: normalizeText(attachment?.label), format: normalizeText(attachment?.format),
      status: normalizeText(attachment?.status), freshness: normalizeText(attachment?.freshness), sourceFingerprint: normalizeText(attachment?.sourceFingerprint),
    })) : [];
    return { eventKey: normalizeEventKey(workspace?.eventKey), season: Number(workspace?.season) || 0, activeScoutingAttachmentId: normalizeText(workspace?.activeScoutingAttachmentId), externalSources, scouting };
  }

  function createEventSourceCacheStore(dependencies = {}) {
    const db = dependencies.db;
    const firestore = dependencies.firestore;
    const createArtifact = dependencies.createRawSourceArtifact || eventSourceCache.createRawSourceArtifact;
    const reconstructArtifact = dependencies.reconstructRawSourceArtifact || eventSourceCache.reconstructRawSourceArtifact;
    if (!db || !firestore?.doc || !firestore?.collection || !firestore?.setDoc || !firestore?.writeBatch || !firestore?.serverTimestamp || !createArtifact || !reconstructArtifact) {
      throw new Error("Firestore and the raw source artifact builder are required for event source caching.");
    }

    const eventDocument = (eventKey) => firestore.doc(db, "events", normalizeEventKey(eventKey));
    const sourceDocument = (eventKey, sourceId) => firestore.doc(eventDocument(eventKey), "sourceCache", normalizeText(sourceId));
    const versionDocument = (eventKey, sourceId, versionId) => firestore.doc(sourceDocument(eventKey, sourceId), "versions", versionId);
    const chunkCollection = (eventKey, sourceId, versionId) => firestore.collection(versionDocument(eventKey, sourceId, versionId), "chunks");

    async function loadEventSourceCache({ eventKey, sourceId } = {}) {
      if (!firestore.getDoc || !firestore.getDocs) throw new Error("Firestore reads are required to load cached source data.");
      const normalizedEventKey = normalizeEventKey(eventKey);
      const normalizedSourceId = normalizeText(sourceId);
      if (!normalizedEventKey || !normalizedSourceId) throw new Error("An event key and source id are required to load cached source data.");
      const pointerSnapshot = await firestore.getDoc(sourceDocument(normalizedEventKey, normalizedSourceId));
      if (!pointerSnapshot?.exists?.()) throw new Error("No cached source is available for this event.");
      const pointer = pointerSnapshot.data();
      const versionId = normalizeText(pointer?.activeVersion);
      if (!versionId) throw new Error("The cached source has no active version.");
      const manifestSnapshot = await firestore.getDoc(versionDocument(normalizedEventKey, normalizedSourceId, versionId));
      if (!manifestSnapshot?.exists?.()) throw new Error("The cached source manifest is unavailable.");
      const manifest = manifestSnapshot.data();
      const chunkSnapshot = await firestore.getDocs(chunkCollection(normalizedEventKey, normalizedSourceId, versionId));
      const chunks = (chunkSnapshot?.docs || []).map((chunk) => chunk.data());
      const raw = reconstructArtifact(manifest, chunks);
      return raw instanceof Uint8Array ? { manifest, rawBytes: raw } : { manifest, rawText: raw };
    }

    async function saveEventSourceCache({ event = {}, workspace = {}, artifacts = [] } = {}) {
      const eventKey = normalizeEventKey(event.key);
      if (!eventKey) throw new Error("An event key is required to cache source data.");
      await firestore.setDoc(eventDocument(eventKey), {
        key: eventKey,
        season: Number(event.season) || 0,
        name: normalizeText(event.name),
        seasonLabel: normalizeText(event.seasonLabel),
        workspace: sharedWorkspaceMetadata(workspace),
        cachedAt: firestore.serverTimestamp(),
      }, { merge: true });
      for (const source of artifacts) {
        const artifact = createArtifact(source);
        const versionId = artifact.manifest.fingerprint.replace(/[^a-z0-9]/gi, "-");
        await firestore.setDoc(versionDocument(eventKey, artifact.manifest.sourceId, versionId), {
          ...artifact.manifest,
          cachedAt: firestore.serverTimestamp(),
        });
        for (let offset = 0; offset < artifact.chunks.length; offset += 400) {
          const batch = firestore.writeBatch(db);
          artifact.chunks.slice(offset, offset + 400).forEach((chunk) => {
            batch.set(firestore.doc(chunkCollection(eventKey, artifact.manifest.sourceId, versionId), String(chunk.index).padStart(6, "0")), chunk);
          });
          await batch.commit();
        }
        await firestore.setDoc(sourceDocument(eventKey, artifact.manifest.sourceId), {
          sourceId: artifact.manifest.sourceId,
          activeVersion: versionId,
          cachedAt: firestore.serverTimestamp(),
        });
      }
    }

    return { saveEventSourceCache, loadEventSourceCache };
  }

  globalScope.EventSourceCacheStore = { createEventSourceCacheStore };
})(globalThis);
