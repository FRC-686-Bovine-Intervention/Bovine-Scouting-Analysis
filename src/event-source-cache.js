(function attachEventSourceCache(globalScope) {
  const maxChunkCharacters = 128 * 1024;

  function normalizeText(value) {
    return String(value ?? "");
  }

  function fingerprint(text) {
    const value = normalizeText(text);
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a:${(hash >>> 0).toString(16)}:${value.length}`;
  }

  function utf8ByteLength(text) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(normalizeText(text)).length;
    return unescape(encodeURIComponent(normalizeText(text))).length;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    Array.from(bytes || []).forEach((value) => { binary += String.fromCharCode(value); });
    return globalScope.btoa ? globalScope.btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  }

  function base64ToBytes(base64) {
    const binary = globalScope.atob ? globalScope.atob(base64) : Buffer.from(base64, "base64").toString("binary");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function chunkRawText(text) {
    const rawText = normalizeText(text);
    const chunks = [];
    for (let offset = 0; offset < rawText.length; offset += maxChunkCharacters) {
      chunks.push(rawText.slice(offset, offset + maxChunkCharacters));
    }
    return chunks.length ? chunks : [""];
  }

  function createRawSourceArtifact(source = {}) {
    const sourceId = normalizeText(source.sourceId).trim();
    if (!sourceId) throw new Error("A source id is required for a raw source artifact.");
    const rawText = source.rawBytes ? bytesToBase64(source.rawBytes) : normalizeText(source.rawText);
    const chunks = chunkRawText(rawText);
    return {
      manifest: {
        sourceId,
        sourceUrl: normalizeText(source.sourceUrl).trim(),
        contentType: normalizeText(source.contentType).trim() || "application/octet-stream",
        encoding: source.rawBytes ? "base64" : "text",
        status: Number(source.status) || 0,
        fetchedAt: normalizeText(source.fetchedAt).trim(),
        fingerprint: fingerprint(rawText),
        byteLength: source.rawBytes ? source.rawBytes.length : utf8ByteLength(rawText),
        chunkCount: chunks.length,
      },
      chunks: chunks.map((text, index) => ({ index, text })),
    };
  }

  function reconstructRawSourceArtifact(manifest = {}, chunks = []) {
    const chunkCount = Number(manifest.chunkCount);
    if (!Number.isInteger(chunkCount) || chunkCount < 1) throw new Error("Raw source manifest has an invalid chunk count.");
    if (!Array.isArray(chunks) || chunks.length !== chunkCount) throw new Error("Raw source cache is incomplete.");
    const sortedChunks = [...chunks].sort((left, right) => Number(left?.index) - Number(right?.index));
    sortedChunks.forEach((chunk, index) => {
      if (Number(chunk?.index) !== index || typeof chunk?.text !== "string") throw new Error("Raw source cache chunks are corrupt.");
    });
    const rawText = sortedChunks.map((chunk) => chunk.text).join("");
    if (fingerprint(rawText) !== normalizeText(manifest.fingerprint)) throw new Error("Raw source cache fingerprint does not match its manifest.");
    if (manifest.encoding === "base64") {
      const bytes = base64ToBytes(rawText);
      if (bytes.length !== Number(manifest.byteLength)) throw new Error("Raw source cache byte length does not match its manifest.");
      return bytes;
    }
    if (utf8ByteLength(rawText) !== Number(manifest.byteLength)) throw new Error("Raw source cache byte length does not match its manifest.");
    return rawText;
  }

  globalScope.EventSourceCache = { maxChunkCharacters, createRawSourceArtifact, reconstructRawSourceArtifact, fingerprint, utf8ByteLength, bytesToBase64, base64ToBytes };
})(globalThis);
