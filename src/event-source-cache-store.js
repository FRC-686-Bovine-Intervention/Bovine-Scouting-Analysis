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
    async function readDocument(reference) {
      try { return await firestore.getDoc(reference); }
      catch (error) {
        if (!firestore.getDocFromCache) throw error;
        return firestore.getDocFromCache(reference);
      }
    }
    async function readCollection(reference) {
      try { return await firestore.getDocs(reference); }
      catch (error) {
        if (!firestore.getDocsFromCache) throw error;
        return firestore.getDocsFromCache(reference);
      }
    }

    async function listCachedEvents() {
      if (!firestore.getDocs) throw new Error("Firestore reads are required to list cached events.");
      const eventsCollection = firestore.collection(db, "events");
      let snapshot;
      let fromCache = false;
      try {
        snapshot = await firestore.getDocs(eventsCollection);
        fromCache = Boolean(snapshot?.metadata?.fromCache);
      } catch (error) {
        if (!firestore.getDocsFromCache) throw error;
        snapshot = await firestore.getDocsFromCache(eventsCollection);
        fromCache = true;
      }
      const events = (snapshot?.docs || []).map((eventSnapshot) => eventSnapshot.data()).map((event) => ({
        key: normalizeEventKey(event?.key), season: Number(event?.season) || 0,
        name: normalizeText(event?.name), seasonLabel: normalizeText(event?.seasonLabel),
      })).filter((event) => event.key && event.season && event.name)
        .sort((left, right) => right.season - left.season || left.name.localeCompare(right.name));
      return { fromCache, events };
    }

    async function listEventSourceCacheSources({ eventKey } = {}) {
      if (!firestore.getDocs) throw new Error("Firestore reads are required to list cached source artifacts.");
      const normalizedEventKey = normalizeEventKey(eventKey);
      if (!normalizedEventKey) throw new Error("An event key is required to list cached source artifacts.");
      let snapshot;
      let fromCache = false;
      try {
        snapshot = await firestore.getDocs(firestore.collection(eventDocument(normalizedEventKey), "sourceCache"));
        fromCache = Boolean(snapshot?.metadata?.fromCache);
      } catch (error) {
        if (!firestore.getDocsFromCache) throw error;
        snapshot = await firestore.getDocsFromCache(firestore.collection(eventDocument(normalizedEventKey), "sourceCache"));
        fromCache = true;
      }
      const sources = (snapshot?.docs || []).map((sourceSnapshot) => sourceSnapshot.data()).map((source) => ({
        sourceId: normalizeText(source?.sourceId),
      })).filter((source) => source.sourceId).sort((left, right) => left.sourceId.localeCompare(right.sourceId));
      return { fromCache, sources };
    }

    async function loadEventSourceCache({ eventKey, sourceId } = {}) {
      if (!firestore.getDoc || !firestore.getDocs) throw new Error("Firestore reads are required to load cached source data.");
      const normalizedEventKey = normalizeEventKey(eventKey);
      const normalizedSourceId = normalizeText(sourceId);
      if (!normalizedEventKey || !normalizedSourceId) throw new Error("An event key and source id are required to load cached source data.");
      const pointerSnapshot = await readDocument(sourceDocument(normalizedEventKey, normalizedSourceId));
      if (!pointerSnapshot?.exists?.()) throw new Error("No cached source is available for this event.");
      const pointer = pointerSnapshot.data();
      const versionId = normalizeText(pointer?.activeVersion);
      if (!versionId) throw new Error("The cached source has no active version.");
      const manifestSnapshot = await readDocument(versionDocument(normalizedEventKey, normalizedSourceId, versionId));
      if (!manifestSnapshot?.exists?.()) throw new Error("The cached source manifest is unavailable.");
      const manifest = manifestSnapshot.data();
      const chunkSnapshot = await readCollection(chunkCollection(normalizedEventKey, normalizedSourceId, versionId));
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

    return { saveEventSourceCache, loadEventSourceCache, listCachedEvents, listEventSourceCacheSources };
  }

  globalScope.EventSourceCacheStore = { createEventSourceCacheStore };
})(globalThis);
