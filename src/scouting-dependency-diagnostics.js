(function () {
const metricEngine = globalThis.MetricEngine || {};
const parseFormulaExpression = metricEngine.parseFormulaExpression || (() => ({ ast: null, error: "Formula parser unavailable." }));
const collectFormulaIdentifiers = metricEngine.collectFormulaIdentifiers || (() => new Set());

function normalizeText(value) {
  return String(value || "").trim();
}

function inferFieldType(fieldDefinition = {}) {
  const explicitType = normalizeText(fieldDefinition.type).toLowerCase();
  if (explicitType) return explicitType;
  const unit = normalizeText(fieldDefinition.unit).toLowerCase();
  return unit === "text" ? "string" : "number";
}

function normalizeFieldDefinitions(fieldDefinitions = []) {
  return (fieldDefinitions || [])
    .map((fieldDefinition) => ({
      id: normalizeText(fieldDefinition?.id),
      label: normalizeText(fieldDefinition?.label) || normalizeText(fieldDefinition?.id),
      type: inferFieldType(fieldDefinition),
      unit: normalizeText(fieldDefinition?.unit),
      aggregate: normalizeText(fieldDefinition?.aggregate),
    }))
    .filter((fieldDefinition) => fieldDefinition.id);
}

function compareScoutingFieldDefinitions(previousFields = [], currentFields = []) {
  const previous = normalizeFieldDefinitions(previousFields);
  const current = normalizeFieldDefinitions(currentFields);
  const previousById = new Map(previous.map((fieldDefinition) => [fieldDefinition.id, fieldDefinition]));
  const currentById = new Map(current.map((fieldDefinition) => [fieldDefinition.id, fieldDefinition]));

  const added = current.filter((fieldDefinition) => !previousById.has(fieldDefinition.id));
  const removed = previous.filter((fieldDefinition) => !currentById.has(fieldDefinition.id));
  const typeChanged = current
    .filter((fieldDefinition) => previousById.has(fieldDefinition.id))
    .map((fieldDefinition) => ({
      previous: previousById.get(fieldDefinition.id),
      current: fieldDefinition,
    }))
    .filter((entry) => entry.previous.type !== entry.current.type)
    .map((entry) => ({
      id: entry.current.id,
      label: entry.current.label || entry.previous.label,
      previousType: entry.previous.type,
      currentType: entry.current.type,
    }));

  return { added, removed, typeChanged };
}

function nodeId(kind, id) {
  return `${kind}:${id}`;
}

function collectFormulaDependencies(formula, catalog) {
  const parsed = parseFormulaExpression(String(formula || ""));
  if (parsed?.error || !parsed?.ast) {
    return {
      dependencies: [],
      parseError: parsed?.error || "Could not parse formula.",
    };
  }
  const identifiers = [...collectFormulaIdentifiers(parsed.ast)];
  const dependencies = [];
  identifiers.forEach((identifier) => {
    const normalizedIdentifier = normalizeText(identifier);
    if (!normalizedIdentifier) return;
    if (normalizedIdentifier.startsWith("scouting.")) {
      const fieldId = normalizedIdentifier.slice("scouting.".length);
      if (fieldId && fieldId !== "total") {
        dependencies.push({
          nodeId: nodeId("field", fieldId),
          kind: "field",
          id: fieldId,
          reason: "scouting_field_reference",
        });
      }
      return;
    }
    if (catalog.equationIds.has(normalizedIdentifier)) {
      dependencies.push({
        nodeId: nodeId("equation", normalizedIdentifier),
        kind: "equation",
        id: normalizedIdentifier,
        reason: "equation_reference",
      });
      return;
    }
    if (catalog.filterIds.has(normalizedIdentifier)) {
      dependencies.push({
        nodeId: nodeId("filter", normalizedIdentifier),
        kind: "filter",
        id: normalizedIdentifier,
        reason: "filter_reference",
      });
    }
  });
  return {
    dependencies: dedupeDependencies(dependencies),
    parseError: "",
  };
}

function dedupeDependencies(dependencies = []) {
  const seen = new Set();
  return (dependencies || []).filter((dependency) => {
    const id = normalizeText(dependency?.nodeId);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function sortEquationDependencies(sortEquation, catalog) {
  const dependencies = [];
  (sortEquation?.terms || []).forEach((term) => {
    const metricId = normalizeText(term?.metricId);
    if (!metricId) return;
    if (metricId.startsWith("source:scouter:")) {
      const fieldId = metricId.slice("source:scouter:".length);
      if (fieldId && fieldId !== "total") {
        dependencies.push({
          nodeId: nodeId("field", fieldId),
          kind: "field",
          id: fieldId,
          reason: "sort_metric_reference",
        });
      }
      return;
    }
    if (metricId.startsWith("derived:")) {
      const derivedId = metricId.slice("derived:".length);
      if (catalog.equationIds.has(derivedId)) {
        dependencies.push({
          nodeId: nodeId("equation", derivedId),
          kind: "equation",
          id: derivedId,
          reason: "sort_metric_reference",
        });
      }
    }
  });
  return dedupeDependencies(dependencies);
}

function buildScoutingDependencyDiagnostics({
  previousFields = [],
  currentFields = [],
  equations = [],
  filters = [],
  sortEquations = [],
} = {}) {
  const schemaDiff = compareScoutingFieldDefinitions(previousFields, currentFields);
  const currentFieldDefinitions = normalizeFieldDefinitions(currentFields);
  const currentFieldIds = new Set(currentFieldDefinitions.map((fieldDefinition) => fieldDefinition.id));
  const catalog = {
    equationIds: new Set((equations || []).map((definition) => normalizeText(definition?.id)).filter(Boolean)),
    filterIds: new Set((filters || []).map((definition) => normalizeText(definition?.id)).filter(Boolean)),
  };

  const nodes = new Map();
  currentFieldDefinitions.forEach((fieldDefinition) => {
    nodes.set(nodeId("field", fieldDefinition.id), {
      nodeId: nodeId("field", fieldDefinition.id),
      kind: "field",
      id: fieldDefinition.id,
      label: fieldDefinition.label,
      dependencies: [],
    });
  });

  (equations || []).forEach((definition) => {
    const id = normalizeText(definition?.id);
    if (!id) return;
    const dependencyInfo = collectFormulaDependencies(definition?.formula || definition?.expression || "", catalog);
    nodes.set(nodeId("equation", id), {
      nodeId: nodeId("equation", id),
      kind: "equation",
      id,
      label: normalizeText(definition?.name) || normalizeText(definition?.label) || id,
      dependencies: dependencyInfo.dependencies,
      parseError: dependencyInfo.parseError,
    });
  });

  (filters || []).forEach((definition) => {
    const id = normalizeText(definition?.id);
    if (!id) return;
    const dependencyInfo = collectFormulaDependencies(definition?.formula || "", catalog);
    nodes.set(nodeId("filter", id), {
      nodeId: nodeId("filter", id),
      kind: "filter",
      id,
      label: normalizeText(definition?.name) || id,
      dependencies: dependencyInfo.dependencies,
      parseError: dependencyInfo.parseError,
    });
  });

  (sortEquations || []).forEach((definition) => {
    const id = normalizeText(definition?.id);
    if (!id) return;
    nodes.set(nodeId("sort", id), {
      nodeId: nodeId("sort", id),
      kind: "sort",
      id,
      label: normalizeText(definition?.name) || id,
      dependencies: sortEquationDependencies(definition, catalog),
    });
  });

  const roots = new Map();
  schemaDiff.removed.forEach((fieldDefinition) => {
    roots.set(nodeId("field", fieldDefinition.id), {
      nodeId: nodeId("field", fieldDefinition.id),
      kind: "field",
      id: fieldDefinition.id,
      label: fieldDefinition.label,
      reason: "removed",
      message: `Scouting field ${fieldDefinition.id} was removed from the current schema.`,
    });
  });
  schemaDiff.typeChanged.forEach((fieldDefinition) => {
    roots.set(nodeId("field", fieldDefinition.id), {
      nodeId: nodeId("field", fieldDefinition.id),
      kind: "field",
      id: fieldDefinition.id,
      label: fieldDefinition.label,
      reason: "type_changed",
      message: `Scouting field ${fieldDefinition.id} changed type from ${fieldDefinition.previousType} to ${fieldDefinition.currentType}.`,
    });
  });

  nodes.forEach((node) => {
    if (node.parseError) {
      roots.set(node.nodeId, {
        nodeId: node.nodeId,
        kind: node.kind,
        id: node.id,
        label: node.label,
        reason: "parse_error",
        message: node.parseError,
      });
    }
    node.dependencies.forEach((dependency) => {
      if (dependency.kind === "field" && !currentFieldIds.has(dependency.id)) {
        const dependencyNodeId = nodeId("field", dependency.id);
        if (!roots.has(dependencyNodeId)) {
          roots.set(dependencyNodeId, {
            nodeId: dependencyNodeId,
            kind: "field",
            id: dependency.id,
            label: dependency.id,
            reason: "missing",
            message: `Scouting field ${dependency.id} is not present in the current schema.`,
          });
        }
      }
    });
  });

  const broken = new Map();

  function diagnose(node) {
    if (!node) return [];
    if (broken.has(node.nodeId)) return broken.get(node.nodeId);
    const directRoot = roots.get(node.nodeId);
    if (directRoot) {
      const result = [directRoot];
      broken.set(node.nodeId, result);
      return result;
    }
    const failures = [];
    node.dependencies.forEach((dependency) => {
      const dependencyRoot = roots.get(dependency.nodeId);
      if (dependencyRoot) {
        failures.push({
          nodeId: dependency.nodeId,
          kind: dependency.kind,
          id: dependency.id,
          reason: dependencyRoot.reason,
          message: dependencyRoot.message,
          via: node.nodeId,
        });
        return;
      }
      const dependencyNode = nodes.get(dependency.nodeId);
      if (!dependencyNode) return;
      diagnose(dependencyNode).forEach((failure) => {
        failures.push({
          ...failure,
          via: `${dependency.nodeId}${failure.via ? ` -> ${failure.via}` : ""}`,
        });
      });
    });
    broken.set(node.nodeId, failures);
    return failures;
  }

  const diagnostics = {
    roots: [...roots.values()],
    byNode: {},
    equations: [],
    filters: [],
    sortEquations: [],
  };

  nodes.forEach((node) => {
    const failures = diagnose(node);
    if (!failures.length) return;
    const entry = {
      nodeId: node.nodeId,
      kind: node.kind,
      id: node.id,
      label: node.label,
      failures,
    };
    diagnostics.byNode[node.nodeId] = entry;
    if (node.kind === "equation") diagnostics.equations.push(entry);
    if (node.kind === "filter") diagnostics.filters.push(entry);
    if (node.kind === "sort") diagnostics.sortEquations.push(entry);
  });

  return {
    schemaDiff,
    nodes: [...nodes.values()],
    diagnostics,
  };
}

globalThis.ScoutingDependencyDiagnostics = {
  buildScoutingDependencyDiagnostics,
  compareScoutingFieldDefinitions,
  normalizeFieldDefinitions,
};
})();
