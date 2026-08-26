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
    return Array.isArray(parsed?.fields)
<<<<<<< HEAD
      ? parsed.fields.map((fieldDefinition) => (
          fieldDefinition
          && typeof fieldDefinition === "object"
          && !Object.prototype.hasOwnProperty.call(fieldDefinition, "typeDeclared")
            ? { ...fieldDefinition, typeDeclared: false }
            : fieldDefinition
        ))
=======
      ? parsed.fields.map((field) => {
          if (typeof field === "string" || !field || typeof field !== "object") return field;
          // Legacy signatures materialized inferred types but had no declaration metadata.
          return { ...field, typeDeclared: field.typeDeclared === true };
        })
>>>>>>> 1afd434 (Suppress legacy inferred schema type changes)
      : [];
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
