(function () {
const dependencyDiagnostics = globalThis.ScoutingDependencyDiagnostics || {};
const buildScoutingDependencyDiagnostics =
  dependencyDiagnostics.buildScoutingDependencyDiagnostics ||
  (() => ({ schemaDiff: { added: [], removed: [], typeChanged: [] }, diagnostics: { roots: [], equations: [], filters: [], sortEquations: [] } }));

function normalizeText(value) {
  return String(value || "").trim();
}

function parseScoutingSchemaSignatureFields(signature) {
  const text = normalizeText(signature);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.fields) ? parsed.fields : [];
  } catch {
    return [];
  }
}

function buildScoutingDiagnosticsState({
  committedSchemaSignature = "",
  currentFieldDefinitions = [],
  previewFieldDefinitions = [],
  equations = [],
  filters = [],
  sortEquations = [],
} = {}) {
  const committedFields = parseScoutingSchemaSignatureFields(committedSchemaSignature);
  const currentDiagnostics = buildScoutingDependencyDiagnostics({
    previousFields: committedFields,
    currentFields: currentFieldDefinitions,
    equations,
    filters,
    sortEquations,
  });
  const pendingDiagnostics = Array.isArray(previewFieldDefinitions) && previewFieldDefinitions.length
    ? buildScoutingDependencyDiagnostics({
        previousFields: committedFields.length ? committedFields : currentFieldDefinitions,
        currentFields: previewFieldDefinitions,
        equations,
        filters,
        sortEquations,
      })
    : null;

  return {
    committedFields,
    currentDiagnostics,
    pendingDiagnostics,
  };
}

globalThis.ScoutingDiagnosticsState = {
  buildScoutingDiagnosticsState,
  parseScoutingSchemaSignatureFields,
};
})();
