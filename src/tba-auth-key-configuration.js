(function attachTbaAuthKeyConfiguration(globalScope) {
  const configurationCollection = "appState";
  const configurationDocumentId = "configuration";
  const validationUrl = "https://www.thebluealliance.com/api/v3/status";

  function normalizeTbaAuthKey(value) {
    return String(value || "").trim();
  }

  function createTbaAuthKeyConfigurationApi(dependencies) {
    const db = dependencies?.db;
    const firestore = dependencies?.firestore;
    const request = dependencies?.fetch || globalScope.fetch;
    if (!db || !firestore?.doc || !firestore?.getDoc || !firestore?.setDoc || !firestore?.serverTimestamp) {
      throw new Error("Firestore is required for TBA auth-key configuration.");
    }

    const configurationDocument = () => firestore.doc(db, configurationCollection, configurationDocumentId);

    async function loadTbaAuthKey() {
      const snapshot = await firestore.getDoc(configurationDocument());
      return snapshot.exists() ? normalizeTbaAuthKey(snapshot.data()?.tbaAuthKey) : "";
    }

    async function saveTbaAuthKey(value) {
      const tbaAuthKey = normalizeTbaAuthKey(value);
      await firestore.setDoc(configurationDocument(), {
        tbaAuthKey,
        updatedAt: firestore.serverTimestamp(),
      }, { merge: true });
      return tbaAuthKey;
    }

    async function validateTbaAuthKey(value) {
      const tbaAuthKey = normalizeTbaAuthKey(value);
      if (!tbaAuthKey) return { configured: false, valid: false, status: "missing" };
      try {
        const response = await request(validationUrl, {
          headers: { "X-TBA-Auth-Key": tbaAuthKey },
        });
        return {
          configured: true,
          valid: Boolean(response?.ok),
          status: response?.ok ? "valid" : "invalid",
        };
      } catch {
        return { configured: true, valid: null, status: "unverified" };
      }
    }

    return { loadTbaAuthKey, saveTbaAuthKey, validateTbaAuthKey };
  }

  globalScope.TbaAuthKeyConfiguration = {
    configurationCollection,
    configurationDocumentId,
    validationUrl,
    normalizeTbaAuthKey,
    createTbaAuthKeyConfigurationApi,
  };
})(globalThis);
