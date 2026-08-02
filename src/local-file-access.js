(function () {
const DB_NAME = "frc-scouting-analysis-local-files";
const STORE_NAME = "attachment-handles";
const SCOUTING_SUBMISSIONS_DB_NAME = "frc-scouting-analysis-event-data";
const SCOUTING_SUBMISSIONS_STORE_NAME = "scouting-submissions";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePathKey(value) {
  return normalizeText(value).replace(/\\/g, "/").toLowerCase();
}

function pathsMatch(left, right) {
  const normalizedLeft = normalizePathKey(left);
  const normalizedRight = normalizePathKey(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function pathBasename(value) {
  const normalized = normalizePathKey(value);
  if (!normalized) return "";
  return normalized.split("/").pop() || "";
}

function resolveDisplayPath(displayPath, handleName) {
  const normalizedDisplayPath = normalizeText(displayPath);
  const normalizedHandleName = normalizeText(handleName);
  if (!normalizedHandleName) return normalizedDisplayPath || "Selected local file";
  if (!normalizedDisplayPath) return normalizedHandleName;
  return pathBasename(normalizedDisplayPath) === normalizePathKey(normalizedHandleName)
    ? normalizedDisplayPath
    : normalizedHandleName;
}

function normalizeStoredAttachmentRecord(value, attachmentId = "", displayPath = "") {
  if (!value || typeof value !== "object") return null;
  if (value.kind === "snapshot") {
    return {
      kind: "snapshot",
      path: normalizeText(value.path) || normalizeText(displayPath) || "Selected local file",
      name: normalizeText(value.name) || pathBasename(value.path) || pathBasename(displayPath),
      text: String(value.text || ""),
    };
  }
  if (value.kind === "handle" && value.handle) {
    return {
      kind: "handle",
      path: normalizeText(value.path) || normalizeText(displayPath) || normalizeText(value.handle?.name) || normalizeText(attachmentId) || "Selected local file",
      name: normalizeText(value.name) || normalizeText(value.handle?.name) || pathBasename(value.path) || pathBasename(displayPath),
      handle: value.handle,
    };
  }
  if (typeof value.getFile === "function" || typeof value.createWritable === "function") {
    return {
      kind: "handle",
      path: normalizeText(displayPath) || normalizeText(value?.name) || normalizeText(attachmentId) || "Selected local file",
      name: normalizeText(value?.name) || pathBasename(displayPath),
      handle: value,
    };
  }
  return null;
}

function supportsHtmlFileInput(deps = {}) {
  const documentRef = deps.document || globalThis.document;
  return Boolean(documentRef && typeof documentRef.createElement === "function" && documentRef.body);
}

function supportsNativeFilePicker(deps = {}) {
  const picker = deps.showOpenFilePicker || globalThis.showOpenFilePicker;
  const locationRef = deps.location || globalThis.location;
  const protocol = normalizeText(locationRef?.protocol).toLowerCase();
  const secureContext = deps.isSecureContext ?? globalThis.isSecureContext;
  if (typeof picker !== "function") return false;
  if (protocol === "file:") return false;
  if (secureContext === false) return false;
  return true;
}

function supportsNativeSaveFilePicker(deps = {}) {
  const picker = deps.showSaveFilePicker || globalThis.showSaveFilePicker;
  const locationRef = deps.location || globalThis.location;
  const protocol = normalizeText(locationRef?.protocol).toLowerCase();
  const secureContext = deps.isSecureContext ?? globalThis.isSecureContext;
  if (typeof picker !== "function") return false;
  if (protocol === "file:") return false;
  if (secureContext === false) return false;
  return true;
}

function buildPickerTypes(format) {
  const normalizedFormat = normalizeText(format).toLowerCase();
  const sharedTypes = [
    { description: "Canonical scouting JSON", accept: { "application/json": [".json"] } },
    { description: "Scouting CSV", accept: { "text/csv": [".csv"], "text/plain": [".csv", ".tsv", ".txt"] } },
  ];
  if (normalizedFormat === "scouting-json") return sharedTypes;
  return sharedTypes;
}

function createIndexedDbKeyValueStorage(options = {}, deps = {}) {
  const indexedDBFactory = deps.indexedDB || globalThis.indexedDB;
  if (!indexedDBFactory || typeof indexedDBFactory.open !== "function") return null;
  const databaseName = normalizeText(options.dbName) || DB_NAME;
  const storeName = normalizeText(options.storeName) || STORE_NAME;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDBFactory.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open local attachment storage."));
    });
  }

  async function withStore(mode, callback) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }
      function fail(error) {
        if (settled) return;
        settled = true;
        reject(error || new Error("Local attachment storage failed."));
      }
      transaction.oncomplete = () => database.close();
      transaction.onabort = () => {
        database.close();
        fail(transaction.error);
      };
      transaction.onerror = () => {
        database.close();
        fail(transaction.error);
      };
      callback(store, finish, fail);
    });
  }

  return {
    get(key) {
      return withStore("readonly", (store, finish, fail) => {
        const request = store.get(key);
        request.onsuccess = () => finish(request.result || null);
        request.onerror = () => fail(request.error);
      });
    },
    getAll() {
      return withStore("readonly", (store, finish, fail) => {
        const request = store.getAll();
        request.onsuccess = () => finish(request.result || []);
        request.onerror = () => fail(request.error);
      });
    },
    set(key, value) {
      return withStore("readwrite", (store, finish, fail) => {
        const request = store.put(value, key);
        request.onsuccess = () => finish(value);
        request.onerror = () => fail(request.error);
      });
    },
    delete(key) {
      return withStore("readwrite", (store, finish, fail) => {
        const request = store.delete(key);
        request.onsuccess = () => finish(true);
        request.onerror = () => fail(request.error);
      });
    },
    clear() {
      return withStore("readwrite", (store, finish, fail) => {
        const request = store.clear();
        request.onsuccess = () => finish(true);
        request.onerror = () => fail(request.error);
      });
    },
  };
}

function createIndexedDbStorage(deps = {}) {
  return createIndexedDbKeyValueStorage({}, deps);
}

function createScoutingSubmissionStorage(deps = {}) {
  return createIndexedDbKeyValueStorage({
    dbName: SCOUTING_SUBMISSIONS_DB_NAME,
    storeName: SCOUTING_SUBMISSIONS_STORE_NAME,
  }, deps);
}

function supportsPersistentLocalFiles(deps = {}) {
  const storage = deps.storage || createIndexedDbStorage(deps);
  return Boolean(storage && typeof storage.get === "function" && typeof storage.set === "function" && (supportsNativeFilePicker(deps) || supportsHtmlFileInput(deps)));
}

function isUserCancelledPicker(error) {
  const name = normalizeText(error?.name);
  const message = normalizeText(error?.message).toLowerCase();
  return name === "AbortError" || message.includes("aborted") || message.includes("cancel");
}

function hasActiveUserActivation(deps = {}) {
  const userActivation = deps.userActivation || globalThis.navigator?.userActivation;
  return Boolean(userActivation?.isActive);
}

async function readTextFromHandleFile(handle) {
  if (typeof handle?.getFile !== "function") {
    throw new Error("The saved local scouting file handle is unreadable.");
  }
  const file = await handle.getFile();
  if (!file || typeof file.text !== "function") {
    throw new Error("The saved local scouting file could not be opened.");
  }
  return file.text();
}

async function withAttachmentPermission(handle, mode, deps = {}, work) {
  try {
    return await work();
  } catch (error) {
    if (typeof handle?.queryPermission !== "function") throw error;
    let permission = await handle.queryPermission({ mode });
    if (
      permission === "prompt"
      && typeof handle.requestPermission === "function"
      && hasActiveUserActivation(deps)
    ) {
      permission = await handle.requestPermission({ mode });
    }
    if (permission !== "granted") {
      throw new Error(`Permission to ${mode} the local scouting file was denied.`);
    }
    return work();
  }
}

async function writeTextToHandleFile(handle, text) {
  if (typeof handle?.createWritable !== "function") {
    throw new Error("The saved local scouting file is not writable.");
  }
  const writable = await handle.createWritable();
  await writable.write(String(text || ""));
  await writable.close();
}

async function requestAttachmentPermission(handle, mode, deps = {}) {
  if (typeof handle?.queryPermission !== "function") return "granted";
  let permission = await handle.queryPermission({ mode });
  if (
    permission === "prompt"
    && typeof handle.requestPermission === "function"
    && hasActiveUserActivation(deps)
  ) {
    permission = await handle.requestPermission({ mode });
  }
  return permission;
}

async function pickAttachmentFileWithInput(options = {}, deps = {}) {
  const documentRef = deps.document || globalThis.document;
  if (!documentRef?.body || typeof documentRef.createElement !== "function") {
    throw new Error("Local scouting file selection is unavailable in this browser.");
  }
  return new Promise((resolve, reject) => {
    const input = documentRef.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv,.tsv,.txt,application/json,text/csv,text/plain";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.addEventListener("change", async () => {
      try {
        const file = input.files?.[0];
        if (!file) throw new Error("No local scouting file was selected.");
        resolve({
          kind: "snapshot",
          path: normalizeText(file.name) || normalizeText(options.path) || "Selected local file",
          name: normalizeText(file.name),
          text: await file.text(),
        });
      } catch (error) {
        reject(error);
      } finally {
        input.remove();
      }
    }, { once: true });
    input.addEventListener("cancel", () => {
      input.remove();
      reject(new Error("No local scouting file was selected."));
    }, { once: true });
    documentRef.body.appendChild(input);
    input.click();
  });
}

async function pickAttachmentFile(options = {}, deps = {}) {
  const attachmentId = normalizeText(options.attachmentId);
  if (!attachmentId) throw new Error("Missing scouting attachment id.");
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.set !== "function" || typeof storage.get !== "function") {
    throw new Error("Persistent local scouting files are unavailable in this browser.");
  }
  if (supportsNativeFilePicker(deps)) {
    const picker = deps.showOpenFilePicker || globalThis.showOpenFilePicker;
    try {
      const handles = await picker({
        multiple: false,
        types: buildPickerTypes(options.format),
        excludeAcceptAllOption: false,
      });
      const handle = Array.isArray(handles) ? handles[0] : handles;
      if (!handle) throw new Error("No local scouting file was selected.");
      if (options.requestWriteAccess === true) {
        const permission = await requestAttachmentPermission(handle, "readwrite", deps);
        if (permission !== "granted") {
          throw new Error("Permission to write the local scouting file was denied.");
        }
      }
      const displayPath = resolveDisplayPath(options.path, handle.name);
      await storage.set(attachmentId, normalizeStoredAttachmentRecord(handle, attachmentId, displayPath));
      return {
        attachmentId,
        path: displayPath,
        name: normalizeText(handle.name),
      };
    } catch (error) {
      if (isUserCancelledPicker(error) || !supportsHtmlFileInput(deps)) throw error;
    }
  }
  const snapshot = await pickAttachmentFileWithInput(options, deps);
  await storage.set(attachmentId, normalizeStoredAttachmentRecord(snapshot, attachmentId, snapshot.path));
  return {
    attachmentId,
    path: snapshot.path,
    name: snapshot.name,
  };
}

async function createAttachmentFile(options = {}, deps = {}) {
  const attachmentId = normalizeText(options.attachmentId);
  if (!attachmentId) throw new Error("Missing scouting attachment id.");
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.set !== "function" || typeof storage.get !== "function") {
    throw new Error("Persistent local scouting files are unavailable in this browser.");
  }
  if (!supportsNativeSaveFilePicker(deps)) {
    throw new Error("Saving a new local scouting file is unavailable in this browser.");
  }
  const picker = deps.showSaveFilePicker || globalThis.showSaveFilePicker;
  const handle = await picker({
    suggestedName: normalizeText(options.suggestedName) || undefined,
    types: buildPickerTypes(options.format),
    excludeAcceptAllOption: false,
  });
  if (!handle) throw new Error("No local scouting file was selected.");
  if (options.requestWriteAccess === true) {
    const permission = await requestAttachmentPermission(handle, "readwrite", deps);
    if (permission !== "granted") {
      throw new Error("Permission to write the local scouting file was denied.");
    }
  }
  const displayPath = normalizeText(options.path) || normalizeText(handle.name) || normalizeText(options.suggestedName) || "Selected local file";
  await storage.set(attachmentId, normalizeStoredAttachmentRecord(handle, attachmentId, displayPath));
  return {
    attachmentId,
    path: displayPath,
    name: normalizeText(handle.name),
  };
}

async function loadAttachmentHandle(attachmentId, deps = {}) {
  const normalizedAttachmentId = normalizeText(attachmentId);
  if (!normalizedAttachmentId) throw new Error("Missing scouting attachment id.");
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.get !== "function") {
    throw new Error("Persistent local scouting files are unavailable in this browser.");
  }
  const storedValue = await storage.get(normalizedAttachmentId);
  if (!storedValue) {
    throw new Error("No saved local scouting file handle exists for this attachment.");
  }
  return normalizeStoredAttachmentRecord(storedValue, normalizedAttachmentId) || storedValue;
}

async function readAttachmentText(attachmentId, deps = {}) {
  const record = await loadAttachmentHandle(attachmentId, deps);
  if (record && typeof record === "object" && record.kind === "snapshot") {
    return String(record.text || "");
  }
  const handle = record?.kind === "handle" ? record.handle : record;
  return withAttachmentPermission(handle, "read", deps, () => readTextFromHandleFile(handle));
}

async function findAttachmentRecordByPath(sourcePath, deps = {}) {
  const normalizedSourcePath = normalizeText(sourcePath);
  if (!normalizedSourcePath) return null;
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.getAll !== "function") return null;
  const storedRecords = await storage.getAll();
  const records = (Array.isArray(storedRecords) ? storedRecords : [])
    .map((record) => normalizeStoredAttachmentRecord(record))
    .filter(Boolean);
  const exactMatch = records.find((record) => pathsMatch(record.path, normalizedSourcePath));
  if (exactMatch) return exactMatch;
  const matchingBasename = pathBasename(normalizedSourcePath);
  const basenameMatches = records.filter((record) => pathBasename(record.path) === matchingBasename);
  return basenameMatches.length === 1 ? basenameMatches[0] : null;
}

async function readAttachmentTextByPath(sourcePath, deps = {}) {
  const record = await findAttachmentRecordByPath(sourcePath, deps);
  if (!record) throw new Error("No saved local scouting file handle exists for this path.");
  if (record.kind === "snapshot") return String(record.text || "");
  return withAttachmentPermission(record.handle, "read", deps, () => readTextFromHandleFile(record.handle));
}

async function adoptAttachmentForPath(attachmentId, sourcePath, deps = {}) {
  const normalizedAttachmentId = normalizeText(attachmentId);
  if (!normalizedAttachmentId) return false;
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.set !== "function") return false;
  const record = await findAttachmentRecordByPath(sourcePath, { ...deps, storage });
  if (!record) return false;
  await storage.set(normalizedAttachmentId, record);
  return true;
}

async function writeAttachmentText(attachmentId, text, deps = {}) {
  const record = await loadAttachmentHandle(attachmentId, deps);
  if (record && typeof record === "object" && record.kind === "snapshot") {
    const storage = deps.storage || createIndexedDbStorage(deps);
    if (!storage || typeof storage.set !== "function") {
      throw new Error("Persistent local scouting files are unavailable in this browser.");
    }
    await storage.set(attachmentId, {
      ...record,
      text: String(text || ""),
    });
    return true;
  }
  const handle = record?.kind === "handle" ? record.handle : record;
  await withAttachmentPermission(handle, "readwrite", deps, () => writeTextToHandleFile(handle, text));
  return true;
}

async function removeAttachment(attachmentId, deps = {}) {
  const normalizedAttachmentId = normalizeText(attachmentId);
  if (!normalizedAttachmentId) return false;
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.delete !== "function") return false;
  await storage.delete(normalizedAttachmentId);
  return true;
}

async function readScoutingSubmissions(eventKey, deps = {}) {
  const normalizedEventKey = normalizeText(eventKey);
  if (!normalizedEventKey) return null;
  const storage = deps.storage || createScoutingSubmissionStorage(deps);
  if (!storage || typeof storage.get !== "function") return null;
  return storage.get(normalizedEventKey);
}

async function writeScoutingSubmissions(eventKey, submissions, deps = {}) {
  const normalizedEventKey = normalizeText(eventKey);
  if (!normalizedEventKey) return false;
  const storage = deps.storage || createScoutingSubmissionStorage(deps);
  if (!storage || typeof storage.set !== "function") return false;
  await storage.set(normalizedEventKey, Array.isArray(submissions) ? submissions : []);
  return true;
}

async function clearScoutingSubmissions(eventKey, deps = {}) {
  const normalizedEventKey = normalizeText(eventKey);
  if (!normalizedEventKey) return false;
  const storage = deps.storage || createScoutingSubmissionStorage(deps);
  if (!storage || typeof storage.delete !== "function") return false;
  await storage.delete(normalizedEventKey);
  return true;
}

async function clearAllScoutingSubmissions(deps = {}) {
  const storage = deps.storage || createScoutingSubmissionStorage(deps);
  if (!storage || typeof storage.clear !== "function") return false;
  await storage.clear();
  return true;
}

globalThis.LocalFileAccess = {
  buildPickerTypes,
  createIndexedDbKeyValueStorage,
  normalizePathKey,
  pathBasename,
  normalizeStoredAttachmentRecord,
  pathsMatch,
  createIndexedDbStorage,
  createScoutingSubmissionStorage,
  pickAttachmentFileWithInput,
  supportsPersistentLocalFiles,
  supportsNativeSaveFilePicker,
  pickAttachmentFile,
  createAttachmentFile,
  loadAttachmentHandle,
  readAttachmentText,
  readAttachmentTextByPath,
  adoptAttachmentForPath,
  writeAttachmentText,
  removeAttachment,
  readScoutingSubmissions,
  writeScoutingSubmissions,
  clearScoutingSubmissions,
  clearAllScoutingSubmissions,
};
})();
