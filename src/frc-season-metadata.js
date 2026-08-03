(function attachFrcSeasonMetadata(globalScope) {
  const configurationCollection = "appState";
  const configurationDocumentId = "configuration";
  const seasonMetadataCollection = "seasonMetadata";
  const apiBaseUrl = "https://frc-api.firstinspires.org/v3.0";

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeSeason(value) {
    const season = Number(value);
    return Number.isInteger(season) && season >= 1992 && season <= 9999 ? season : 0;
  }

  function toDisplaySeasonLabel(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/(^|[\s-])([^\s-])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  }

  function encodeBasicCredentials(username, authorizationKey) {
    const rawCredentials = `${normalizeText(username)}:${normalizeText(authorizationKey)}`;
    if (typeof globalScope.btoa === "function") return globalScope.btoa(rawCredentials);
    throw new Error("This browser cannot encode FIRST API credentials.");
  }

  function createFrcSeasonMetadataApi(dependencies) {
    const db = dependencies?.db;
    const firestore = dependencies?.firestore;
    const request = dependencies?.fetch || globalScope.fetch;
    if (!db || !firestore?.doc || !firestore?.getDoc || !firestore?.setDoc || !firestore?.serverTimestamp) {
      throw new Error("Firestore is required for FIRST season metadata.");
    }

    const configurationDocument = () => firestore.doc(db, configurationCollection, configurationDocumentId);
    const seasonMetadataDocument = (season) => firestore.doc(db, seasonMetadataCollection, String(normalizeSeason(season)));

    async function loadCredentials() {
      const snapshot = await firestore.getDoc(configurationDocument());
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      return {
        username: normalizeText(data.frcApiUsername),
        authorizationKey: normalizeText(data.frcApiAuthorizationKey),
      };
    }

    async function saveCredentials(credentials = {}) {
      const normalizedCredentials = {
        username: normalizeText(credentials.username),
        authorizationKey: normalizeText(credentials.authorizationKey),
      };
      await firestore.setDoc(configurationDocument(), {
        frcApiUsername: normalizedCredentials.username,
        frcApiAuthorizationKey: normalizedCredentials.authorizationKey,
        updatedAt: firestore.serverTimestamp(),
      }, { merge: true });
      return normalizedCredentials;
    }

    async function loadSeasonMetadata(season) {
      const normalizedSeason = normalizeSeason(season);
      if (!normalizedSeason) return null;
      const snapshot = await firestore.getDoc(seasonMetadataDocument(normalizedSeason));
      if (!snapshot.exists()) return null;
      const data = snapshot.data() || {};
      const gameName = normalizeText(data.gameName);
      if (!gameName) return null;
      return {
        season: normalizedSeason,
        gameName,
        source: normalizeText(data.source),
        fetchedAt: data.fetchedAt?.toDate?.().toISOString?.() || normalizeText(data.fetchedAt),
      };
    }

    function subscribeSeasonMetadata(season, listener) {
      const normalizedSeason = normalizeSeason(season);
      if (!normalizedSeason || typeof firestore.onSnapshot !== "function") return () => {};
      return firestore.onSnapshot(seasonMetadataDocument(normalizedSeason), (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() || {} : {};
        const gameName = normalizeText(data.gameName);
        listener(gameName ? { season: normalizedSeason, gameName, source: normalizeText(data.source), fetchedAt: data.fetchedAt?.toDate?.().toISOString?.() || normalizeText(data.fetchedAt) } : null);
      });
    }

    async function validateCredentials(credentials = {}, season = 2020) {
      const normalizedSeason = normalizeSeason(season);
      const username = normalizeText(credentials.username);
      const authorizationKey = normalizeText(credentials.authorizationKey);
      if (!username || !authorizationKey) return { configured: false, valid: false, status: "missing" };
      try {
        const response = await request(`${apiBaseUrl}/${normalizedSeason}`, {
          headers: { Authorization: `Basic ${encodeBasicCredentials(username, authorizationKey)}` },
        });
        return { configured: true, valid: Boolean(response?.ok), status: response?.ok ? "valid" : "invalid" };
      } catch {
        return { configured: true, valid: null, status: "unverified" };
      }
    }

    async function refreshSeasonMetadata(season, credentials = {}) {
      const normalizedSeason = normalizeSeason(season);
      const username = normalizeText(credentials.username);
      const authorizationKey = normalizeText(credentials.authorizationKey);
      if (!normalizedSeason) throw new Error("Enter a valid FRC season.");
      if (!username || !authorizationKey) throw new Error("Configure both FIRST API credentials before refreshing a season title.");
      const response = await request(`${apiBaseUrl}/${normalizedSeason}`, {
        headers: { Authorization: `Basic ${encodeBasicCredentials(username, authorizationKey)}` },
      });
      if (!response?.ok) throw new Error(`FIRST API season summary request failed (${response?.status || "network error"}).`);
      const payload = await response.json();
      const gameName = normalizeText(payload?.gameName);
      if (!gameName) throw new Error("The FIRST API season summary did not include a game name.");
      const metadata = {
        season: normalizedSeason,
        gameName,
        source: "first-events-api",
      };
      await firestore.setDoc(seasonMetadataDocument(normalizedSeason), {
        ...metadata,
        fetchedAt: firestore.serverTimestamp(),
      });
      return metadata;
    }

    return { loadCredentials, saveCredentials, loadSeasonMetadata, subscribeSeasonMetadata, validateCredentials, refreshSeasonMetadata };
  }

  globalScope.FrcSeasonMetadata = {
    configurationCollection,
    configurationDocumentId,
    seasonMetadataCollection,
    apiBaseUrl,
    normalizeSeason,
    toDisplaySeasonLabel,
    createFrcSeasonMetadataApi,
  };
})(globalThis);
