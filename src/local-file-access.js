(function () {
const DB_NAME = "frc-scouting-analysis-local-files";
const STORE_NAME = "attachment-handles";

function normalizeText(value) {
  return String(value || "").trim();
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

function buildPickerTypes(format) {
  const normalizedFormat = normalizeText(format).toLowerCase();
  const sharedTypes = [
    { description: "Canonical scouting JSON", accept: { "application/json": [".json"] } },
    { description: "Scouting CSV", accept: { "text/csv": [".csv"], "text/plain": [".csv", ".tsv", ".txt"] } },
  ];
  if (normalizedFormat === "scouting-json") return sharedTypes;
  return sharedTypes;
}

function createIndexedDbStorage(deps = {}) {
  const indexedDBFactory = deps.indexedDB || globalThis.indexedDB;
  if (!indexedDBFactory || typeof indexedDBFactory.open !== "function") return null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDBFactory.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open local attachment storage."));
    });
  }

  async function withStore(mode, callback) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
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
  };
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
      await storage.set(attachmentId, handle);
      return {
        attachmentId,
        path: normalizeText(handle.name) || normalizeText(options.path) || "Selected local file",
        name: normalizeText(handle.name),
      };
    } catch (error) {
      if (isUserCancelledPicker(error) || !supportsHtmlFileInput(deps)) throw error;
    }
  }
  const snapshot = await pickAttachmentFileWithInput(options, deps);
  await storage.set(attachmentId, snapshot);
  return {
    attachmentId,
    path: snapshot.path,
    name: snapshot.name,
  };
}

async function loadAttachmentHandle(attachmentId, deps = {}) {
  const normalizedAttachmentId = normalizeText(attachmentId);
  if (!normalizedAttachmentId) throw new Error("Missing scouting attachment id.");
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.get !== "function") {
    throw new Error("Persistent local scouting files are unavailable in this browser.");
  }
  const handle = await storage.get(normalizedAttachmentId);
  if (!handle) {
    throw new Error("No saved local scouting file handle exists for this attachment.");
  }
  return handle;
}

async function readAttachmentText(attachmentId, deps = {}) {
  const handle = await loadAttachmentHandle(attachmentId, deps);
  if (handle && typeof handle === "object" && handle.kind === "snapshot") {
    return String(handle.text || "");
  }
  if (typeof handle.queryPermission === "function") {
    let permission = await handle.queryPermission({ mode: "read" });
    if (permission === "prompt" && typeof handle.requestPermission === "function") {
      permission = await handle.requestPermission({ mode: "read" });
    }
    if (permission !== "granted") {
      throw new Error("Permission to read the local scouting file was denied.");
    }
  }
  if (typeof handle.getFile !== "function") {
    throw new Error("The saved local scouting file handle is unreadable.");
  }
  const file = await handle.getFile();
  if (!file || typeof file.text !== "function") {
    throw new Error("The saved local scouting file could not be opened.");
  }
  return file.text();
}

async function removeAttachment(attachmentId, deps = {}) {
  const normalizedAttachmentId = normalizeText(attachmentId);
  if (!normalizedAttachmentId) return false;
  const storage = deps.storage || createIndexedDbStorage(deps);
  if (!storage || typeof storage.delete !== "function") return false;
  await storage.delete(normalizedAttachmentId);
  return true;
}

globalThis.LocalFileAccess = {
  buildPickerTypes,
  createIndexedDbStorage,
  pickAttachmentFileWithInput,
  supportsPersistentLocalFiles,
  pickAttachmentFile,
  loadAttachmentHandle,
  readAttachmentText,
  removeAttachment,
};
})();
