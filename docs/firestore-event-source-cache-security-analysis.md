# Firestore raw event source-cache security analysis

Issue #77 adds `events/{eventKey}` catalog metadata and a versioned raw-source
cache. `sourceCache/{sourceId}` holds only an active-version pointer;
`versions/{fingerprint}` holds the manifest; and `chunks/{chunkId}` holds the
raw chunks. The pointer is written only after every chunk is committed, so a
reader never selects a partial replacement. The event record excludes
credentials, local paths, and provider URLs. Its workspace projection contains
only source health and attachment identifiers.

The manifest records source URL, content type, HTTP status, retrieval time, FNV
fingerprint, byte length, and chunk count. Chunks contain only an ordinal and
raw text, capped at 128 Ki characters. Binary responses are base64 encoded
before chunking, then reconstructed as their original bytes.

Allowed users may read cached event/source data. Only administrators may create
or update it. Normalized submissions remain in their separate collection. No
client query, `where`, `orderBy`, or `limit` is introduced. Rules reject extra
fields, oversized chunks, invalid ids, and non-admin writes on both create and
update. The regression tests exercise publication order, reconstruction,
corruption detection, and rule-shape constraints.
