const storageKeys = {
  user: "frc-scouting-user",
  users: "frc-scouting-users",
  theme: "frc-scouting-theme",
  activeView: "frc-scouting-view",
  metric: "frc-scouting-metric",
  teamDetailMetric: "frc-scouting-team-detail-metric",
  picklistCompareMetric: "frc-scouting-picklist-compare-metric",
  selectedTeam: "frc-scouting-selected-team",
  selectedMatch: "frc-scouting-selected-match",
  menuExpanded: "frc-scouting-menu-expanded",
  loadedPicklists: "frc-scouting-loaded-picklists",
  allianceBoard: "frc-scouting-alliance-board",
  picklists: "frc-scouting-picklists",
  activePicklist: "frc-scouting-active-picklist",
  sortEquations: "frc-scouting-sort-equations",
  activeSortEquation: "frc-scouting-active-sort-equation",
  picklistColumns: "frc-scouting-picklist-columns",
  picklistCompareTeams: "frc-scouting-picklist-compare-teams",
};

const seedUsers = ["Avery", "Jordan", "Morgan"];
const adminUsers = ["Avery"];

const event = {
  key: "2026miket",
  name: "Lake Superior Regional",
  season: 2026,
  matchesComplete: 42,
};

const metrics = [
  { id: "scouterTotal", label: "Scouter Total", unit: "pts" },
  { id: "epa", label: "EPA", unit: "pts" },
  { id: "pridge", label: "pRidge", unit: "pts" },
  { id: "defenseImpact", label: "Defense Impact", unit: "pts" },
  { id: "consistency", label: "Consistency", unit: "%" },
];

const navItems = [
  { view: "teams", label: "Teams", icon: "teams" },
  { view: "rankings", label: "Rankings", icon: "rankings" },
  { view: "schedule", label: "Match Schedule", icon: "schedule" },
  { view: "matchup", label: "Matchup", icon: "matchup" },
  { view: "quality", label: "Data Quality", icon: "quality" },
  { view: "analysis", label: "Analysis", icon: "analysis" },
  { view: "sortBuilder", label: "Sort Builder", icon: "sortEquation" },
  { view: "picklistBuilder", label: "Picklist Builder", icon: "picklists" },
  { view: "alliance", label: "Alliance Selection", icon: "alliance" },
  { view: "admin", label: "Admin", icon: "admin" },
];

const appViews = [...navItems, { view: "teamDetail", label: "Team Detail", icon: "teams" }];

const teams = [
  {
    number: 118,
    name: "Robonauts",
    drivetrain: "swerve",
    flags: [{ type: "defense_specialist", label: "Defense", severity: "good", evidence: "Reduced opponent scoring in 3 marked defense matches." }],
    matches: [42, 50, 47, 54, 61, 38, 57, 62],
    epa: 49.1,
    pridge: 51.4,
    defenseImpact: 10.8,
    consistency: 82,
  },
  {
    number: 1678,
    name: "Citrus Circuits",
    drivetrain: "swerve",
    flags: [],
    matches: [58, 63, 61, 65, 67, 62, 64, 69],
    epa: 61.8,
    pridge: 63.2,
    defenseImpact: 2.1,
    consistency: 94,
  },
  {
    number: 254,
    name: "Cheesy Poofs",
    drivetrain: "swerve",
    flags: [],
    matches: [55, 57, 62, 60, 66, 64, 68, 70],
    epa: 60.4,
    pridge: 62.5,
    defenseImpact: 1.7,
    consistency: 92,
  },
  {
    number: 2056,
    name: "OP Robotics",
    drivetrain: "swerve",
    flags: [{ type: "inconsistent", label: "Inconsistent", severity: "warn", evidence: "Large scoring spread across qualification matches." }],
    matches: [38, 59, 41, 63, 46, 66, 44, 70],
    epa: 53.7,
    pridge: 55.9,
    defenseImpact: 4.2,
    consistency: 61,
  },
  {
    number: 2910,
    name: "Jack in the Bot",
    drivetrain: "swerve",
    flags: [],
    matches: [47, 51, 55, 58, 60, 61, 64, 66],
    epa: 56.5,
    pridge: 57.1,
    defenseImpact: 3.8,
    consistency: 88,
  },
  {
    number: 4414,
    name: "HighTide",
    drivetrain: "swerve",
    flags: [{ type: "declining", label: "Declining", severity: "warn", evidence: "Last 3 matches are 14% below event average for this team." }],
    matches: [64, 62, 59, 56, 51, 47, 43, 41],
    epa: 52.2,
    pridge: 50.8,
    defenseImpact: 2.9,
    consistency: 72,
  },
  {
    number: 6328,
    name: "Mechanical Advantage",
    drivetrain: "swerve",
    flags: [{ type: "data_suspect", label: "Suspect Data", severity: "warn", evidence: "One scout entry conflicts with alliance score by 28 points." }],
    matches: [45, 49, 77, 50, 52, 53, 55, 54],
    epa: 51.0,
    pridge: 50.1,
    defenseImpact: 3.2,
    consistency: 76,
  },
  {
    number: 7426,
    name: "Pair of Dice",
    drivetrain: "tank",
    flags: [
      { type: "do_not_pick", label: "DNP", severity: "danger", evidence: "Pit scouting notes drivetrain damage and repeated disconnects." },
      { type: "broken", label: "Broken", severity: "danger", evidence: "No mobility in final two observed matches." },
    ],
    matches: [31, 35, 33, 29, 24, 18, 4, 0],
    epa: 22.4,
    pridge: 20.5,
    defenseImpact: 1.1,
    consistency: 38,
  },
  {
    number: 971,
    name: "Spartan Robotics",
    drivetrain: "swerve",
    flags: [],
    matches: [46, 49, 52, 55, 57, 58, 60, 63],
    epa: 53.4,
    pridge: 54.2,
    defenseImpact: 4.8,
    consistency: 86,
  },
  {
    number: 1323,
    name: "MadTown Robotics",
    drivetrain: "swerve",
    flags: [],
    matches: [51, 53, 55, 58, 61, 63, 60, 66],
    epa: 57.8,
    pridge: 58.6,
    defenseImpact: 4.4,
    consistency: 89,
  },
  {
    number: 3005,
    name: "RoboChargers",
    drivetrain: "swerve",
    flags: [{ type: "data_suspect", label: "Sparse", severity: "warn", evidence: "Only 4 scouted matches imported." }],
    matches: [39, 43, 48, 51],
    epa: 44.9,
    pridge: 45.1,
    defenseImpact: 5.7,
    consistency: 70,
  },
  {
    number: 6800,
    name: "Valor",
    drivetrain: "tank",
    flags: [{ type: "defense_specialist", label: "Defense", severity: "good", evidence: "Scouters marked effective defense in 4 matches." }],
    matches: [26, 28, 30, 29, 31, 27, 32, 30],
    epa: 30.2,
    pridge: 31.4,
    defenseImpact: 12.6,
    consistency: 91,
  },
  {
    number: 27,
    name: "RUSH",
    drivetrain: "swerve",
    flags: [],
    matches: [43, 45, 47, 49, 52, 54, 53, 56],
    epa: 48.6,
    pridge: 49.3,
    defenseImpact: 5.1,
    consistency: 84,
  },
  {
    number: 33,
    name: "Killer Bees",
    drivetrain: "swerve",
    flags: [{ type: "defense_specialist", label: "Defense", severity: "good", evidence: "Strong pin timing and protected-zone awareness in recent matches." }],
    matches: [40, 42, 45, 46, 48, 49, 51, 50],
    epa: 46.8,
    pridge: 47.4,
    defenseImpact: 9.3,
    consistency: 86,
  },
  {
    number: 67,
    name: "HOT Team",
    drivetrain: "swerve",
    flags: [],
    matches: [49, 52, 50, 55, 57, 56, 58, 60],
    epa: 54.6,
    pridge: 55.2,
    defenseImpact: 4.7,
    consistency: 87,
  },
  {
    number: 148,
    name: "Robowranglers",
    drivetrain: "swerve",
    flags: [{ type: "climber", label: "Climb+", severity: "good", evidence: "Reliable endgame contribution in all imported matches." }],
    matches: [53, 56, 58, 59, 62, 64, 63, 65],
    epa: 58.9,
    pridge: 59.7,
    defenseImpact: 3.1,
    consistency: 90,
  },
  {
    number: 217,
    name: "ThunderChickens",
    drivetrain: "swerve",
    flags: [],
    matches: [44, 47, 49, 50, 48, 52, 54, 55],
    epa: 49.9,
    pridge: 50.6,
    defenseImpact: 6.2,
    consistency: 83,
  },
  {
    number: 359,
    name: "Hawaiian Kids",
    drivetrain: "tank",
    flags: [{ type: "inconsistent", label: "Inconsistent", severity: "warn", evidence: "Fast scoring cycles, but several dead-time stretches were observed." }],
    matches: [36, 44, 39, 52, 41, 55, 46, 57],
    epa: 45.3,
    pridge: 46.0,
    defenseImpact: 7.4,
    consistency: 64,
  },
  {
    number: 604,
    name: "Quixilver",
    drivetrain: "swerve",
    flags: [],
    matches: [41, 43, 45, 47, 46, 48, 50, 51],
    epa: 46.1,
    pridge: 46.8,
    defenseImpact: 4.9,
    consistency: 85,
  },
  {
    number: 1114,
    name: "Simbotics",
    drivetrain: "swerve",
    flags: [],
    matches: [56, 59, 61, 60, 64, 66, 65, 68],
    epa: 60.7,
    pridge: 61.6,
    defenseImpact: 3.9,
    consistency: 93,
  },
  {
    number: 1690,
    name: "Orbit",
    drivetrain: "swerve",
    flags: [],
    matches: [54, 57, 59, 62, 63, 61, 66, 67],
    epa: 59.4,
    pridge: 60.1,
    defenseImpact: 3.4,
    consistency: 91,
  },
  {
    number: 1796,
    name: "RoboTigers",
    drivetrain: "tank",
    flags: [{ type: "data_suspect", label: "Sparse", severity: "warn", evidence: "Only partial pit and match scouting is available." }],
    matches: [28, 34, 31, 36, 33, 38],
    epa: 34.8,
    pridge: 35.6,
    defenseImpact: 8.9,
    consistency: 67,
  },
  {
    number: 8840,
    name: "Bay Robotics",
    drivetrain: "swerve",
    flags: [{ type: "rising", label: "Rising", severity: "good", evidence: "Last three matches are trending above their event average." }],
    matches: [32, 36, 39, 42, 45, 48, 50, 53],
    epa: 42.7,
    pridge: 44.2,
    defenseImpact: 5.5,
    consistency: 79,
  },
  {
    number: 10255,
    name: "Five Digit Demo",
    drivetrain: "swerve",
    flags: [
      { type: "rising", label: "Rising", severity: "good", evidence: "Cycle times improved steadily over the last four matches." },
      { type: "data_suspect", label: "Sparse", severity: "warn", evidence: "One autonomous entry is missing from the scouting sheet." },
    ],
    matches: [30, 35, 37, 41, 43, 46, 49, 52],
    epa: 41.6,
    pridge: 43.1,
    defenseImpact: 6.6,
    consistency: 75,
  },
].map(enrichTeam);

const matches = [
  { number: 38, red: [1678, 4414, 6800], blue: [254, 3005, 7426] },
  { number: 39, red: [118, 2910, 6328], blue: [1323, 971, 2056] },
  { number: 40, red: [254, 971, 6800], blue: [1678, 118, 3005] },
  { number: 41, red: [2056, 1323, 7426], blue: [2910, 4414, 6328] },
];

const dataSources = [
  {
    name: "Scouting Spreadsheet",
    status: "Mocked import",
    updated: "Demo seed loaded",
    notes: "CSV/XLSX import contract is represented, but files are not parsed yet.",
  },
  {
    name: "The Blue Alliance",
    status: "Mocked sync",
    updated: "Event shell loaded",
    notes: "Event teams, rankings, and schedule are demo data shaped like TBA inputs.",
  },
  {
    name: "Statbotics EPA",
    status: "Mocked sync",
    updated: "EPA values seeded",
    notes: "EPA is stored per team and used by rankings, analysis, and picklist criteria.",
  },
  {
    name: "pRidge",
    status: "Mocked sync",
    updated: "pRidge values seeded",
    notes: "pRidge is available as a metric source and weighted-sum component.",
  },
];

const gameComponentRatios = [
  { id: "total", label: "Total", ratio: 1 },
  { id: "auto", label: "Auto", ratio: 0.18 },
  { id: "coral", label: "Coral", ratio: 0.5 },
  { id: "algae", label: "Algae", ratio: 0.2 },
  { id: "climb", label: "Climb", ratio: 0.12 },
];

function gameComponents(baseValue) {
  return gameComponentRatios.map((component) => ({
    id: component.id,
    label: component.label,
    value: (team) => baseValue(team) * component.ratio,
  }));
}

const criteriaSources = [
  {
    id: "epa",
    label: "EPA",
    components: gameComponents((team) => team.epa),
  },
  {
    id: "scouter",
    label: "Scouter Data",
    components: gameComponents((team) => team.scouterTotal),
  },
  {
    id: "opr",
    label: "OPR",
    components: gameComponents((team) => team.scouterTotal * 1.06),
  },
  {
    id: "pridge",
    label: "pRidge",
    components: gameComponents((team) => team.pridge),
  },
  {
    id: "derived",
    label: "Derived",
    components: [
      { id: "defenseImpact", label: "Defense Impact", value: (team) => team.defenseImpact },
      { id: "consistency", label: "Consistency", value: (team) => team.consistency },
    ],
  },
];

const defaultCriteriaTerms = [{ operator: "+", weight: 1, source: "epa", component: "total" }];

const picklistColumnCount = 4;
const picklistCompareLimit = 4;
const protectedEpaSortId = "sort-epa";
const compareTeamPalette = ["#2563eb", "#ca8a04", "#7c3aed", "#0891b2"];

const seedSortEquations = [
  {
    id: "sort-defense-backup",
    name: "Defense / Backup Formula",
    terms: [
      { operator: "+", weight: 0.05, source: "scouter", component: "total" },
      { operator: "+", weight: 0.75, source: "derived", component: "defenseImpact" },
      { operator: "+", weight: 0.2, source: "derived", component: "consistency" },
    ],
  },
];

const seedPicklists = [
  {
    id: "pick-first-pick",
    name: "First Pick",
    teams: [1678, 254, 1323, 2910, 971, 2056, 4414, 6328, 118, 3005, 6800, 7426],
  },
  {
    id: "pick-defense-backup",
    name: "Defense / Backup",
    teams: [6800, 118, 3005, 971, 1323, 2056, 2910, 6328, 4414, 1678, 254, 7426],
  },
];

const defaultAllianceBoard = [1678, 254, 1323, 2910, 971, 118, 2056, 4414, ...Array(16).fill(null)];
const eventTeamNumbers = [...teams].map((team) => team.number).sort((a, b) => a - b);
const protectedEpaSortEquation = {
  id: protectedEpaSortId,
  name: "EPA",
  metricId: "epa",
  locked: true,
};

const state = {
  user: localStorage.getItem(storageKeys.user) || "",
  users: readJson(storageKeys.users, seedUsers),
  theme: localStorage.getItem(storageKeys.theme) || "light",
  activeView: normalizeView(localStorage.getItem(storageKeys.activeView)),
  metric: normalizeAnalysisSelection(localStorage.getItem(storageKeys.metric)),
  teamDetailMetric: normalizeTeamDetailMetric(localStorage.getItem(storageKeys.teamDetailMetric)),
  picklistCompareMetric: normalizeTeamDetailMetric(localStorage.getItem(storageKeys.picklistCompareMetric)),
  selectedTeam: Number(localStorage.getItem(storageKeys.selectedTeam)) || teams[0].number,
  selectedMatch: Number(localStorage.getItem(storageKeys.selectedMatch)) || matches[0].number,
  menuExpanded: localStorage.getItem(storageKeys.menuExpanded) === "true",
  picklists: normalizePicklists(readJson(storageKeys.picklists, seedPicklists)),
  sortEquations: normalizeSortEquations(readJson(storageKeys.sortEquations, seedSortEquations)),
  loadedSources: [],
  activePicklist: "",
  activeSortEquation: "",
  picklistColumns: [],
  allianceBoard: normalizeBoard(readJson(storageKeys.allianceBoard, defaultAllianceBoard)),
  contextMenu: null,
  inlineRename: null,
  picklistSelectedTeam: null,
  picklistCompareTeams: normalizePicklistCompareTeams(readJson(storageKeys.picklistCompareTeams, [])),
  builderFocus: { sortBuilder: "list", picklistBuilder: "list" },
};

state.activePicklist = resolvePicklistId(localStorage.getItem(storageKeys.activePicklist), state.picklists) || state.picklists[0]?.id || "";
state.activeSortEquation =
  resolveSortEquationId(localStorage.getItem(storageKeys.activeSortEquation), state.sortEquations) || state.sortEquations[0]?.id || "";
state.loadedSources = normalizeLoadedSources(readJson(storageKeys.loadedPicklists, [`picklist:${seedPicklists[0].id}`]));
state.picklistColumns = normalizePicklistColumns(readJson(storageKeys.picklistColumns, Array(picklistColumnCount).fill("")));
if (!state.loadedSources.length && state.picklists.length) state.loadedSources = [`picklist:${state.picklists[0].id}`];

document.documentElement.dataset.theme = state.theme;

const app = document.querySelector("#app");
render();

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function saveState() {
  localStorage.setItem(storageKeys.users, JSON.stringify(state.users));
  localStorage.setItem(storageKeys.user, state.user);
  localStorage.setItem(storageKeys.theme, state.theme);
  localStorage.setItem(storageKeys.activeView, state.activeView);
  localStorage.setItem(storageKeys.metric, state.metric);
  localStorage.setItem(storageKeys.teamDetailMetric, state.teamDetailMetric);
  localStorage.setItem(storageKeys.picklistCompareMetric, state.picklistCompareMetric);
  localStorage.setItem(storageKeys.selectedTeam, String(state.selectedTeam));
  localStorage.setItem(storageKeys.selectedMatch, String(state.selectedMatch));
  localStorage.setItem(storageKeys.menuExpanded, String(state.menuExpanded));
  localStorage.setItem(storageKeys.picklists, JSON.stringify(state.picklists));
  localStorage.setItem(storageKeys.sortEquations, JSON.stringify(state.sortEquations));
  localStorage.setItem(storageKeys.loadedPicklists, JSON.stringify(state.loadedSources));
  localStorage.setItem(storageKeys.activePicklist, state.activePicklist);
  localStorage.setItem(storageKeys.activeSortEquation, state.activeSortEquation);
  localStorage.setItem(storageKeys.picklistColumns, JSON.stringify(state.picklistColumns));
  localStorage.setItem(storageKeys.allianceBoard, JSON.stringify(state.allianceBoard));
  localStorage.setItem(storageKeys.picklistCompareTeams, JSON.stringify(state.picklistCompareTeams));
}

function normalizeView(view) {
  return appViews.some((item) => item.view === view) ? view : "teams";
}

function normalizeBoard(board) {
  const next = Array.isArray(board) ? board.slice(0, 24) : [];
  while (next.length < 24) next.push(null);
  return next.map((value) => (Number.isFinite(Number(value)) && value !== "" ? Number(value) : null));
}

function normalizeAnalysisSelection(value) {
  if (typeof value !== "string" || !value) return "epa";
  if (value.startsWith("sort:")) {
    return value;
  }
  return metrics.some((metric) => metric.id === value) ? value : "epa";
}

function normalizeTeamDetailMetric(value) {
  if (typeof value !== "string" || !value) return "scouterTotal";
  return metrics.some((metric) => metric.id === value) ? value : "scouterTotal";
}

function pickedTeams() {
  return state.allianceBoard.filter((team) => team !== null);
}

function isAdmin() {
  return adminUsers.includes(state.user);
}

function userLabel(user) {
  return adminUsers.includes(user) ? `${user} (Admin)` : user;
}

function canView(view) {
  return view !== "admin" || isAdmin();
}

function visibleNavItems() {
  return navItems.filter((item) => canView(item.view));
}

function resolvePicklistId(value, picklists = state.picklists) {
  if (!value) return "";
  const stringValue = String(value);
  const match = picklists.find((picklist) => picklist.id === stringValue || picklist.name === stringValue);
  return match?.id || "";
}

function resolveSortEquationId(value, sortEquations = state.sortEquations) {
  if (!value) return "";
  const stringValue = String(value);
  const match = sortEquations.find((equation) => equation.id === stringValue || equation.name === stringValue);
  return match?.id || "";
}

function normalizeSortEquations(equations) {
  const source = Array.isArray(equations) ? equations : [];
  const hasPersistedValues = Array.isArray(equations);
  const normalized = source
    .filter((equation) => equation && equation.id !== protectedEpaSortId)
    .map((equation) => ({
      id: equation.id || createId("sort"),
      name: equation.name || "Sort Equation",
      terms: normalizeCriteriaTerms(equation.terms || termsFromLegacyWeights(equation.weights)),
      locked: false,
    }));
  const fallback = normalized.length || hasPersistedValues ? normalized : seedSortEquations.map((equation) => ({
    id: equation.id || createId("sort"),
    name: equation.name || "Sort Equation",
    terms: normalizeCriteriaTerms(equation.terms || termsFromLegacyWeights(equation.weights)),
    locked: false,
  }));
  return [protectedEpaSortEquation, ...fallback];
}

function normalizePicklists(lists) {
  const source = Array.isArray(lists) && lists.length ? lists : seedPicklists;
  return source.map((list) => ({
    id: list.id || createId("pick"),
    name: list.name || "Picklist",
    teams: normalizePicklistTeams(list.teams),
  }));
}

function normalizePicklistTeams(values) {
  const ranked = Array.isArray(values) ? values.map(Number).filter((value, index, array) => teamByNumber(value) && array.indexOf(value) === index) : [];
  const missing = eventTeamNumbers.filter((number) => !ranked.includes(number));
  return [...ranked, ...missing];
}

function normalizeLoadedSources(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((entry) => normalizeSourceEntry(entry))
    .filter((entry, index, array) => entry && array.indexOf(entry) === index);
}

function normalizePicklistCompareTeams(values) {
  const next = Array.isArray(values) ? values.slice(0, picklistCompareLimit) : [];
  while (next.length < picklistCompareLimit) next.push(null);
  const seen = new Set();
  return next.map((value) => {
    const teamNumber = Number(value);
    if (!teamByNumber(teamNumber)) return null;
    if (seen.has(teamNumber)) return null;
    seen.add(teamNumber);
    return teamNumber;
  });
}

function normalizePicklistColumns(columns) {
  const next = Array.isArray(columns) ? columns.slice(0, picklistColumnCount) : [];
  while (next.length < picklistColumnCount) next.push("");
  return next.map((entry) => {
    if (!entry) return "";
    if (typeof entry !== "string") return "";
    return normalizeSourceEntry(entry);
  });
}

function normalizeSourceEntry(entry) {
  if (!entry || typeof entry !== "string") return "";
  if (entry.startsWith("sort:")) {
    const id = resolveSortEquationId(entry.slice(5));
    return id ? `sort:${id}` : "";
  }
  if (entry.startsWith("picklist:")) {
    const id = resolvePicklistId(entry.slice(9));
    return id ? `picklist:${id}` : "";
  }
  const legacyPicklistId = resolvePicklistId(entry);
  return legacyPicklistId ? `picklist:${legacyPicklistId}` : "";
}

function activePicklist() {
  return state.picklists.find((picklist) => picklist.id === state.activePicklist) || state.picklists[0];
}

function activeSortEquation() {
  return state.sortEquations.find((equation) => equation.id === state.activeSortEquation) || state.sortEquations[0];
}

function isProtectedSortEquation(equation) {
  return Boolean(equation?.locked);
}

function updatePicklist(id, updater) {
  state.picklists = state.picklists.map((picklist) => (picklist.id === id ? updater(picklist) : picklist));
  saveState();
  render();
}

function updateSortEquation(id, updater) {
  if (id === protectedEpaSortId) return;
  state.sortEquations = state.sortEquations.map((equation) => (equation.id === id ? updater(equation) : equation));
  saveState();
  render();
}

function termsFromLegacyWeights(weights = {}) {
  const mappings = {
    scouterTotal: { source: "scouter", component: "total" },
    epa: { source: "epa", component: "total" },
    pridge: { source: "pridge", component: "total" },
    defenseImpact: { source: "derived", component: "defenseImpact" },
    consistency: { source: "derived", component: "consistency" },
  };
  const terms = Object.entries(weights)
    .filter(([, weight]) => Number(weight) !== 0)
    .map(([id, weight]) => ({ operator: "+", weight: Number(weight), ...(mappings[id] || mappings.epa) }));
  return terms.length ? terms : defaultCriteriaTerms;
}

function normalizeCriteriaTerms(terms) {
  const normalized = (Array.isArray(terms) && terms.length ? terms : defaultCriteriaTerms).slice(0, 5).map((term, index) => {
    const source = criteriaSources.find((item) => item.id === term.source) || criteriaSources[0];
    const component = source.components.find((item) => item.id === term.component) || source.components[0];
    return {
      operator: index === 0 ? "+" : term.operator === "-" ? "-" : "+",
      weight: Number.isFinite(Number(term.weight)) ? Number(term.weight) : 1,
      source: source.id,
      component: component.id,
    };
  });
  return normalized.length ? normalized : defaultCriteriaTerms;
}

function componentValue(team, term) {
  const source = criteriaSources.find((item) => item.id === term.source) || criteriaSources[0];
  const component = source.components.find((item) => item.id === term.component) || source.components[0];
  return component.value(team);
}

function scoreTeamByTerms(team, terms) {
  return normalizeCriteriaTerms(terms).reduce((score, term, index) => {
    const sign = index === 0 || term.operator === "+" ? 1 : -1;
    return score + sign * Number(term.weight || 0) * componentValue(team, term);
  }, 0);
}

function rankTeamsByTerms(terms) {
  return [...teams].sort((a, b) => scoreTeamByTerms(b, terms) - scoreTeamByTerms(a, terms)).map((team) => team.number);
}

function scoreTeamByEquation(team, equation) {
  if (equation.metricId) return Number(team[equation.metricId] || 0);
  return scoreTeamByTerms(team, equation.terms);
}

function rankTeamsByEquation(equation) {
  return [...teams]
    .sort((a, b) => scoreTeamByEquation(b, equation) - scoreTeamByEquation(a, equation) || a.number - b.number)
    .map((team) => team.number);
}

function colorForScore(score, min, max) {
  if (max === min) return "transparent";
  const ratio = (score - min) / (max - min);
  if (ratio >= 2 / 3) {
    const strength = (ratio - 2 / 3) * 3;
    return `rgba(34, 197, 94, ${strength.toFixed(3)})`;
  }
  if (ratio <= 1 / 3) {
    const strength = (1 / 3 - ratio) * 3;
    return `rgba(239, 68, 68, ${strength.toFixed(3)})`;
  }
  return "transparent";
}

function enrichTeam(team) {
  const scouterTotal = average(team.matches);
  return {
    ...team,
    scouterTotal,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function metricById(id) {
  return metrics.find((metric) => metric.id === id) || metrics.find((metric) => metric.id === "epa") || metrics[0];
}

function teamDetailMetric() {
  return metrics.find((metric) => metric.id === state.teamDetailMetric) || metrics[0];
}

function picklistCompareMetric() {
  return metrics.find((metric) => metric.id === state.picklistCompareMetric) || metrics[0];
}

function analysisSortEquations() {
  return state.sortEquations.filter((equation) => !isProtectedSortEquation(equation));
}

function analysisSelectionModel() {
  if (typeof state.metric === "string" && state.metric.startsWith("sort:")) {
    const equation = state.sortEquations.find((item) => item.id === state.metric.slice(5));
    if (equation) return { type: "sortEquation", id: equation.id, label: equation.name, unit: "pts", equation };
  }
  const metric = metricById(state.metric);
  return { type: "metric", id: metric.id, label: metric.label, unit: metric.unit, metric };
}

function compareSlotIndexForTeam(teamNumber) {
  return state.picklistCompareTeams.indexOf(teamNumber);
}

function compareAccent(teamNumber) {
  const index = compareSlotIndexForTeam(teamNumber);
  return index < 0 ? null : compareTeamPalette[index];
}

function togglePicklistCompareTeam(teamNumber) {
  const existingIndex = compareSlotIndexForTeam(teamNumber);
  if (existingIndex >= 0) {
    state.picklistCompareTeams[existingIndex] = null;
    return true;
  }
  const emptyIndex = state.picklistCompareTeams.indexOf(null);
  if (emptyIndex < 0) return false;
  state.picklistCompareTeams[emptyIndex] = teamNumber;
  return true;
}

function teamByNumber(number) {
  return teams.find((team) => team.number === Number(number));
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  saveState();
  render();
}

function toggleTheme() {
  setTheme(state.theme === "light" ? "dark" : "light");
}

function setView(view) {
  if (!canView(view)) view = "teams";
  state.activeView = view;
  state.contextMenu = null;
  state.inlineRename = null;
  saveState();
  render();
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
  }
  if (!canView(state.activeView)) {
    state.activeView = "teams";
    saveState();
  }

  app.innerHTML = `
    <div class="app-shell ${state.menuExpanded ? "menu-expanded" : "menu-collapsed"}">
      <aside class="sidebar">
        <div class="brand-row">
          <div>
            <p class="eyebrow">FRC</p>
            <h1>Scouting Analysis</h1>
          </div>
          <button class="icon-button" id="menuToggle" title="${state.menuExpanded ? "Collapse menu" : "Expand menu"}" aria-label="${state.menuExpanded ? "Collapse menu" : "Expand menu"}">
            ${icon("menu")}
          </button>
        </div>
        <div class="event-chip">
          <span class="muted">${event.season}</span>
          <strong>${event.name}</strong>
          <span class="muted">${event.matchesComplete} matches imported</span>
        </div>
        <nav class="nav-list">
          ${visibleNavItems().map((item) => navButton(item)).join("")}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="page-title">
            <p class="eyebrow">${event.key}</p>
            <h1>${viewTitle(state.activeView)}</h1>
          </div>
          <div class="split-row">
            ${renderThemeToggle()}
            <button class="action-button" id="logoutButton" title="Sign out ${state.user}" aria-label="Sign out ${state.user}">
              ${icon("user")}
              <span>${state.user}</span>
              ${isAdmin() ? `<span class="user-role">Admin</span>` : ""}
            </button>
          </div>
        </header>
        <section class="content">${renderView()}</section>
      </main>
    </div>
  `;

  bindShellEvents();
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <div class="brand-row">
          <div>
            <p class="eyebrow">FRC Event Strategy</p>
            <h1>Scouting Analysis</h1>
          </div>
          ${renderThemeToggle()}
        </div>
        <div class="login-actions">
          <label>
            Existing user
            <select id="existingUser">
              <option value="">Select user</option>
              ${state.users.map((user) => `<option value="${user}">${userLabel(user)}</option>`).join("")}
            </select>
          </label>
          <button class="primary" id="loginButton">Continue</button>
          <label>
            New user
            <input id="newUser" placeholder="Name" autocomplete="off" />
          </label>
          <button id="createUserButton">Create user</button>
        </div>
      </section>
    </main>
  `;

  document.querySelector("#themeToggle")?.addEventListener("click", toggleTheme);
  document.querySelector("#loginButton").addEventListener("click", () => {
    const selected = document.querySelector("#existingUser").value;
    if (!selected) return;
    state.user = selected;
    saveState();
    render();
  });
  document.querySelector("#createUserButton").addEventListener("click", () => {
    const input = document.querySelector("#newUser");
    const user = input.value.trim();
    if (!user) return;
    if (!state.users.includes(user)) state.users.push(user);
    state.user = user;
    saveState();
    render();
  });
}

function renderThemeToggle() {
  const nextTheme = state.theme === "light" ? "dark" : "light";
  const label = `Switch to ${nextTheme} mode`;
  return `
    <button class="icon-button theme-toggle" id="themeToggle" title="${label}" aria-label="${label}">
      ${icon(state.theme === "light" ? "sun" : "moon")}
    </button>
  `;
}

function icon(name) {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    moon: '<path d="M21 14.8A8.5 8.5 0 0 1 9.2 3 7 7 0 1 0 21 14.8Z"/>',
    teams: '<path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2 21a6 6 0 0 1 12 0"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M22 21a5 5 0 0 0-6-5"/>',
    rankings: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    analysis: '<path d="M4 19h16"/><path d="M6 15h10"/><path d="M8 11h12"/><path d="M5 7h7"/><path d="M14 7h4"/>',
    schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    matchup: '<path d="M7 7h10"/><path d="M7 17h10"/><path d="M9 7a3 3 0 1 1 0 6"/><path d="M15 17a3 3 0 1 1 0-6"/>',
    quality: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    picklists: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    sortEquation:
      '<text x="12" y="17" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor" stroke="none">Σ</text>',
    alliance: '<path d="M4 5h7v6H4z"/><path d="M13 5h7v6h-7z"/><path d="M4 13h7v6H4z"/><path d="M13 13h7v6h-7z"/>',
    admin: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.1-.1a1.7 1.7 0 0 0-2-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-2 .3l-.1.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2v-4h1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.1.1a1.7 1.7 0 0 0 2 .3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 2-.3l.1-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H22v4h-1a1.7 1.7 0 0 0-1.6 1Z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.analysis}</svg>`;
}

function navButton(item) {
  const active = state.activeView === item.view ? "active" : "";
  return `
    <button class="nav-button ${active}" data-view="${item.view}" title="${item.label}" aria-label="${item.label}">
      <span class="nav-icon">${icon(item.icon)}</span>
      <span class="nav-label">${item.label}</span>
    </button>
  `;
}

function viewTitle(view) {
  return {
    teams: "Teams",
    teamDetail: "Team Detail",
    rankings: "Rankings",
    analysis: "Analysis",
    schedule: "Match Schedule",
    matchup: "Matchup",
    quality: "Data Quality",
    sortBuilder: "Sort Builder",
    picklistBuilder: "Picklist Builder",
    alliance: "Alliance Selection",
    admin: "Admin",
  }[view];
}

function bindShellEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelector("#themeToggle")?.addEventListener("click", toggleTheme);
  document.querySelector("#menuToggle").addEventListener("click", () => {
    state.menuExpanded = !state.menuExpanded;
    saveState();
    render();
  });
  document.querySelector("#logoutButton").addEventListener("click", () => {
    state.user = "";
    saveState();
    render();
  });
  bindViewEvents();
}

function renderView() {
  return {
    teams: renderTeams,
    teamDetail: () => renderTeamDetail(teamByNumber(state.selectedTeam)),
    rankings: renderRankings,
    analysis: renderAnalysis,
    schedule: renderSchedule,
    matchup: renderMatchup,
    quality: renderQuality,
    sortBuilder: renderSortBuilder,
    picklistBuilder: renderPicklistBuilder,
    alliance: renderAlliance,
    admin: renderAdmin,
  }[state.activeView]();
}

function renderRankings() {
  const ranked = [...teams]
    .sort((a, b) => b.epa - a.epa)
    .map((team, index) => ({ ...team, rank: index + 1, rp: rankingPoints(team), record: recordForTeam(team) }));
  return `
    <article class="card">
      <div class="section-heading">
        <div>
          <h2>Current Event Rankings</h2>
        </div>
        <span class="muted">Sorted by ranking score, then EPA</span>
      </div>
      <div class="ranking-table" role="table" aria-label="Current event rankings">
        <div class="ranking-row ranking-header" role="row">
          <span>Rank</span>
          <span>Team</span>
          <span>Ranking Score</span>
          <span>Record</span>
          <span>RP</span>
          <span>EPA</span>
          <span>Flags</span>
        </div>
        ${ranked
          .map(
            (team) => `
          <button class="ranking-row" data-team="${team.number}" role="row">
            <strong>${team.rank}</strong>
            <span>${team.number} ${team.name}</span>
            <span>${team.epa.toFixed(2)}</span>
            <span>${team.record}</span>
            <span>${team.rp}</span>
            <span>${team.epa.toFixed(1)}</span>
            <span>${renderTeamBadges(team)}</span>
          </button>
        `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function rankingPoints(team) {
  return Math.max(8, Math.round(team.epa / 4));
}

function recordForTeam(team) {
  const wins = Math.max(1, Math.min(8, Math.round(team.epa / 9)));
  const losses = Math.max(0, 8 - wins);
  return `${wins}-${losses}-0`;
}

function renderTeams() {
  return `
    <div class="team-title-row">
      <div>
        <h2>Event Teams</h2>
      </div>
      <span class="muted">${teams.length} teams at ${event.name}</span>
    </div>
    <div class="team-grid" style="margin-top: 14px;">
      ${teams
        .sort((a, b) => a.number - b.number)
        .map(
          (team) => `
        <button class="team-card" data-team="${team.number}">
          <span class="avatar">${team.number}</span>
          <span class="team-meta">
            <strong>${team.name}</strong>
            <span class="muted">${team.epa.toFixed(1)} EPA / ${team.consistency}% consistency</span>
            ${renderTeamBadges(team)}
          </span>
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderTeamDetail(team) {
  const selectedMetric = teamDetailMetric();
  return `
    <article class="card">
      <div class="section-heading">
        <div>
          <h2>${team.name}</h2>
        </div>
        <div class="detail-actions">
          <button data-view="teams">Back to Teams</button>
          <select id="teamSelect" aria-label="Team">
            ${teams.map((item) => `<option value="${item.number}" ${item.number === team.number ? "selected" : ""}>${item.number} ${item.name}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><span>Scouter Total</span><strong>${team.scouterTotal.toFixed(1)}</strong></div>
        <div class="stat"><span>EPA</span><strong>${team.epa.toFixed(1)}</strong></div>
        <div class="stat"><span>pRidge</span><strong>${team.pridge.toFixed(1)}</strong></div>
        <div class="stat"><span>Consistency</span><strong>${team.consistency}%</strong></div>
      </div>
      <div class="team-detail-grid">
        <div>
          <div class="section-heading">
            <div>
              <h3>Match Trend</h3>
            </div>
            <label class="team-trend-metric">
              <span class="muted">Metric</span>
              <select id="teamDetailMetricSelect" aria-label="Team detail metric">
                ${metrics.map((item) => `<option value="${item.id}" ${item.id === selectedMetric.id ? "selected" : ""}>${item.label}</option>`).join("")}
              </select>
            </label>
          </div>
          ${renderSparkline(team, selectedMetric)}
        </div>
        <div class="compact-flags">
          <h3>Flags</h3>
          ${team.flags.length ? team.flags.map((flag) => `<p><span class="flag ${flag.severity}">${flag.label}</span> <span class="flag-evidence">${flag.evidence}</span></p>`).join("") : `<p class="muted">No active flags.</p>`}
        </div>
      </div>
    </article>
  `;
}

function metricTrendValues(team, metric) {
  if (metric.id === "scouterTotal") return team.matches;
  const baseline = average(team.matches) || 1;
  return team.matches.map((value) => (value / baseline) * Number(team[metric.id] || 0));
}

function renderSparkline(team, metric) {
  const values = metricTrendValues(team, metric);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = 16 + (index / Math.max(1, values.length - 1)) * 196;
      const y = 82 - ((value - min) / range) * 64;
      return `${x},${y}`;
    })
    .join(" ");
  return `
    <svg class="trend-chart" viewBox="0 0 220 100" role="img" aria-label="${escapeAttribute(`${metric.label} by match number`)}" width="100%" height="260">
      <line x1="16" y1="82" x2="212" y2="82" stroke="var(--line)" stroke-width="1"></line>
      <line x1="16" y1="18" x2="16" y2="82" stroke="var(--line)" stroke-width="1"></line>
      <text x="114" y="97" text-anchor="middle">Match Number</text>
      <text x="4" y="50" text-anchor="middle" transform="rotate(-90 4 50)">${metric.label} (${metric.unit})</text>
      <text x="14" y="20" text-anchor="end">${max.toFixed(metric.unit === "%" ? 0 : 1)}</text>
      <text x="14" y="84" text-anchor="end">${min.toFixed(metric.unit === "%" ? 0 : 1)}</text>
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke"></polyline>
      ${values
        .map((value, index) => {
          const x = 16 + (index / Math.max(1, values.length - 1)) * 196;
          const y = 82 - ((value - min) / range) * 64;
          return `<circle cx="${x}" cy="${y}" r="2.6" fill="var(--accent-strong)"><title>Match ${index + 1}: ${value.toFixed(metric.unit === "%" ? 0 : 1)} ${metric.unit}</title></circle>`;
        })
        .join("")}
    </svg>
  `;
}

function renderAnalysis() {
  const selection = analysisSelectionModel();
  const ranked =
    selection.type === "sortEquation"
      ? rankTeamsByEquation(selection.equation).map((number) => teamByNumber(number)).filter(Boolean)
      : [...teams].sort((a, b) => b[selection.metric.id] - a[selection.metric.id]);
  const scoreForTeam =
    selection.type === "sortEquation"
      ? (team) => scoreTeamByEquation(team, selection.equation)
      : (team) => Number(team[selection.metric.id] || 0);
  const allScores = ranked.map((team) => scoreForTeam(team));
  const scoreRange = {
    min: Math.min(...allScores),
    max: Math.max(...allScores),
  };
  const distributions = ranked.map((team) =>
    selection.type === "sortEquation"
      ? distributionForEquationScore(scoreForTeam(team), scoreRange.min, scoreRange.max)
      : distributionForMetric(team, selection.metric.id),
  );
  const globalMin = Math.min(...distributions.map((item) => item.min));
  const globalMax = Math.max(...distributions.map((item) => item.max));
  const eventAverage = average(allScores);
  const axisTicks = Array.from({ length: 5 }, (_, index) => globalMin + ((globalMax - globalMin) * index) / 4);
  return `
    <div class="toolbar">
      <label>
        Metric
        <select id="metricSelect">
          <optgroup label="Metrics">
            ${metrics.map((item) => `<option value="${item.id}" ${item.id === state.metric ? "selected" : ""}>${item.label}</option>`).join("")}
          </optgroup>
          <optgroup label="Sort Equations">
            ${analysisSortEquations().map((item) => `<option value="sort:${item.id}" ${state.metric === `sort:${item.id}` ? "selected" : ""}>${item.name}</option>`).join("")}
          </optgroup>
        </select>
      </label>
      <div class="stat"><span>Event Average</span><strong>${eventAverage.toFixed(1)} ${selection.unit}</strong></div>
      ${selection.type === "sortEquation" ? '<div class="stat"><span>Source</span><strong>Sort Equation</strong></div>' : ""}
      ${renderBoxPlotLegend()}
    </div>
    <div class="analysis-chart" style="margin-top: 8px;">
      ${ranked.map((team, index) => renderChartRow(team, selection, distributions[index], globalMin, globalMax, eventAverage, scoreForTeam(team))).join("")}
    </div>
    <div class="analysis-axis-row" aria-hidden="true">
      <span></span>
      <div class="analysis-axis-meta">
        <div class="analysis-axis-ticks">
          ${axisTicks.map((value, index) => `<span style="left: ${(index / (axisTicks.length - 1)) * 100}%">${value.toFixed(1)}</span>`).join("")}
        </div>
        <span class="analysis-axis-label">${selection.label} (${selection.unit})</span>
      </div>
      <span></span>
    </div>
  `;
}

function renderBoxPlotLegend() {
  return `
    <div class="boxplot-legend" aria-label="Box and whisker legend">
      <span><i class="legend-whisker"></i> Min/Max</span>
      <span><i class="legend-quartile"></i> Q1-Q3</span>
      <span><i class="legend-median"></i> Median</span>
      <span><i class="legend-mean"></i> Mean</span>
      <span><i class="legend-average"></i> Event Avg</span>
    </div>
  `;
}

function distributionForMetric(team, metricId) {
  if (metricId === "scouterTotal") {
    const values = team.matches;
    return {
      min: Math.min(...values),
      q1: quantile(values, 0.25),
      median: quantile(values, 0.5),
      q3: quantile(values, 0.75),
      max: Math.max(...values),
      mean: average(values),
    };
  }
  const center = team[metricId];
  const spread = metricId === "consistency" ? 5 : 3;
  return {
    min: center - spread,
    q1: center - spread * 0.45,
    median: center,
    q3: center + spread * 0.45,
    max: center + spread,
    mean: center,
  };
}

function distributionForEquationScore(score, minScore, maxScore) {
  const spread = Math.max((maxScore - minScore) * 0.05, 1);
  return {
    min: score - spread,
    q1: score - spread * 0.45,
    median: score,
    q3: score + spread * 0.45,
    max: score + spread,
    mean: score,
  };
}

function renderChartRow(team, selection, dist, globalMin, globalMax, eventAverage, teamScore) {
  const scale = (value) => {
    const pct = ((value - globalMin) / (globalMax - globalMin || 1)) * 100;
    return Math.max(0, Math.min(100, pct));
  };
  const whiskerLeft = scale(dist.min);
  const whiskerWidth = scale(dist.max) - whiskerLeft;
  const qLeft = scale(dist.q1);
  const qWidth = scale(dist.q3) - qLeft;
  const median = scale(dist.median);
  const mean = scale(dist.mean);
  const avg = scale(eventAverage);
  const plotTitle = [
    `${team.number} ${team.name}`,
    `Min: ${dist.min.toFixed(1)} ${selection.unit}`,
    `Q1: ${dist.q1.toFixed(1)} ${selection.unit}`,
    `Median: ${dist.median.toFixed(1)} ${selection.unit}`,
    `Mean: ${dist.mean.toFixed(1)} ${selection.unit}`,
    `Q3: ${dist.q3.toFixed(1)} ${selection.unit}`,
    `Max: ${dist.max.toFixed(1)} ${selection.unit}`,
  ].join("\n");
  return `
    <div class="chart-row">
      <div class="chart-team">
        <span class="chart-badges">${renderTeamBadges(team)}</span>
        <button class="chart-name" data-team-link="${team.number}">${team.number}</button>
      </div>
      <div class="plot" title="${escapeAttribute(plotTitle)}">
        <span class="event-average" style="left: ${avg}%"></span>
        <span class="whisker" style="left: ${whiskerLeft}%; width: ${whiskerWidth}%"></span>
        <span class="quartile" style="left: ${qLeft}%; width: ${qWidth}%"></span>
        <span class="median" style="left: ${median}%"></span>
        <span class="mean" style="left: ${mean}%"></span>
      </div>
      <div class="chart-value">${teamScore.toFixed(1)}</div>
    </div>
  `;
}

function renderSchedule() {
  return `
    <div class="section-heading">
      <div>
        <h2>Match Schedule</h2>
      </div>
    </div>
    <div class="grid">
      ${matches
        .map(
          (match) => `
        <article class="match-row" data-match-row="${match.number}" title="Open Q${match.number} matchup">
          <button class="match-link" data-match="${match.number}">Q${match.number}</button>
          <span class="alliance red">${match.red.map((team) => `<button class="pill team-pill" data-team="${team}">${team}</button>`).join("")}</span>
          <span class="alliance blue">${match.blue.map((team) => `<button class="pill team-pill" data-team="${team}">${team}</button>`).join("")}</span>
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderMatchup() {
  const match = matches.find((item) => item.number === state.selectedMatch) || matches[0];
  return `
    <div class="section-heading">
      <div>
        <h2>Alliance Matchup</h2>
      </div>
      ${renderMatchNavigator(match, true)}
    </div>
    <div class="grid cols-2">
      ${renderAllianceCard("Red Alliance", match.red)}
      ${renderAllianceCard("Blue Alliance", match.blue)}
    </div>
  `;
}

function renderMatchNavigator(match, includeBack) {
  const matchIndex = matches.findIndex((item) => item.number === match.number);
  const prevMatch = matches[matchIndex - 1];
  const nextMatch = matches[matchIndex + 1];
  return `
    <div class="match-nav">
      ${includeBack ? `<button data-view="schedule">Back to schedule</button>` : ""}
      <button class="icon-button" data-match-nav="${prevMatch?.number || ""}" ${prevMatch ? "" : "disabled"} title="Previous match" aria-label="Previous match">&lt;</button>
      <strong>Q${match.number}</strong>
      <button class="icon-button" data-match-nav="${nextMatch?.number || ""}" ${nextMatch ? "" : "disabled"} title="Next match" aria-label="Next match">&gt;</button>
    </div>
  `;
}

function renderAllianceCard(title, teamNumbers) {
  return `
    <article class="card">
      <h2>${title}</h2>
      <div class="grid">
        ${teamNumbers
          .map((number) => {
            const team = teamByNumber(number);
            return `
              <button class="team-card" data-team="${team.number}">
                <span class="avatar">${team.number}</span>
                <span class="team-meta">
                  <strong>${team.name}</strong>
                  <span class="muted">${team.epa.toFixed(1)} EPA / ${team.consistency}% consistency</span>
                  ${renderTeamBadges(team)}
                </span>
              </button>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderQuality() {
  const flagged = teams.filter((team) => team.flags.some((flag) => ["data_suspect", "broken", "declining", "inconsistent"].includes(flag.type)));
  return `
    <div class="grid">
      ${flagged
        .map(
          (team) => `
        <button class="data-row" data-team="${team.number}">
          <div class="split-row">
            <strong>${team.number} ${team.name}</strong>
            ${renderTeamBadges(team)}
          </div>
          ${team.flags.map((flag) => `<span class="flag-evidence">${flag.evidence}</span>`).join("")}
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderSortBuilder() {
  const equation = activeSortEquation();
  const rankedTeams = rankTeamsByEquation(equation).map((number) => teamByNumber(number)).filter(Boolean);
  const rowScores = rankedTeams.map((team) => scoreTeamByEquation(team, equation));
  const minScore = Math.min(...rowScores);
  const maxScore = Math.max(...rowScores);
  return `
    <div class="grid sort-builder-layout">
      <article class="card builder-list-card">
        <div class="section-heading">
          <div>
            <h2>Sort Equations</h2>
          </div>
          <button class="icon-button" id="addSortEquationButton" title="Add sort equation" aria-label="Add sort equation">+</button>
        </div>
        <div class="builder-list" data-entity-list="sortEquation" tabindex="0">
          ${state.sortEquations.map((item, index) => renderEntityListItem("sortEquation", item, index, item.id === equation.id)).join("")}
        </div>
        ${renderContextMenu()}
      </article>
      <article class="card sort-preview-card">
        <div class="section-heading">
          <div>
            <h2>Ranked Teams</h2>
            <p class="muted">Scores update as the selected equation changes.</p>
          </div>
        </div>
        <div class="builder-team-list">
          ${rankedTeams
            .map((team, index) => {
              const score = scoreTeamByEquation(team, equation);
              return renderTeamTile(team, index, {
                score,
                minScore,
                maxScore,
                showScore: true,
                showName: true,
              });
            })
            .join("")}
        </div>
      </article>
      <article class="card sort-builder-editor-card">
        <div class="section-heading">
          <div>
            <h2>${equation.name}</h2>
            <p class="muted">${isProtectedSortEquation(equation) ? "Source: EPA" : "Edits update the ranked preview immediately."}</p>
          </div>
        </div>
        ${
          isProtectedSortEquation(equation)
            ? `
          <div class="card read-only-source-card">
            <strong>${icon("lock")} EPA</strong>
            <span class="muted">Source: EPA</span>
          </div>
        `
            : `
          <div class="criteria-builder">
            ${equation.terms.map((term, index) => renderCriteriaTerm(term, index, equation.terms.length)).join("")}
          </div>
        `
        }
      </article>
    </div>
  `;
}

function renderPicklistBuilder() {
  const picklist = activePicklist();
  const currentTeams = picklist.teams.map((number) => teamByNumber(number)).filter(Boolean);
  const compareTeams = state.picklistCompareTeams.map((number) => teamByNumber(number)).filter(Boolean);
  const comparisonMetric = picklistCompareMetric();
  return `
    <div class="grid picklist-builder-layout">
      <article class="card builder-list-card">
        <div class="section-heading">
          <div>
            <h2>Picklists</h2>
          </div>
          <button class="icon-button" id="addPicklistButton" title="Add picklist" aria-label="Add picklist">+</button>
        </div>
        <div class="builder-list" data-entity-list="picklist" tabindex="0">
          ${state.picklists.map((item, index) => renderEntityListItem("picklist", item, index, item.id === picklist.id)).join("")}
        </div>
        ${renderContextMenu()}
      </article>
      <article class="card current-picklist-card">
        <div class="section-heading">
          <div>
            <h2>${picklist.name}</h2>
            <p class="muted">Drag to reorder, or use arrow keys with Shift for one-slot moves.</p>
          </div>
        </div>
        <div class="picklist-list-offset" aria-hidden="true"></div>
        <div class="builder-team-list current-picklist-list" data-current-picklist tabindex="0">
          ${currentTeams.map((team, index) => renderBuilderTeamTile(team, index, { draggable: true })).join("")}
        </div>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Comparison Grid</h2>
            <p class="muted">Pick sort equations or saved picklists to compare side by side.</p>
          </div>
        </div>
        <div class="builder-grid-columns">
          ${state.picklistColumns.map((entry, index) => renderPicklistGridColumn(entry, index)).join("")}
        </div>
      </article>
      <article class="card picklist-compare-chart-card">
        <div class="section-heading">
          <div>
            <h2>Team Trend Comparison</h2>
            <p class="muted">Overlay up to 4 selected teams using the same comparison colors as the picklist.</p>
          </div>
          <label class="team-trend-metric">
            <span class="muted">Metric</span>
            <select id="picklistCompareMetricSelect" aria-label="Picklist comparison metric">
              ${metrics.map((item) => `<option value="${item.id}" ${item.id === comparisonMetric.id ? "selected" : ""}>${item.label}</option>`).join("")}
            </select>
          </label>
        </div>
        ${renderPicklistCompareChart(compareTeams, comparisonMetric)}
      </article>
    </div>
  `;
}

function renderPicklistCompareChart(selectedTeams, metric) {
  if (!selectedTeams.length) {
    return `<div class="empty-state picklist-compare-empty">Select up to 4 teams in the current picklist to compare their trends here.</div>`;
  }
  const series = selectedTeams.map((team) => ({
    team,
    values: metricTrendValues(team, metric),
    color: compareAccent(team.number) || "var(--accent)",
  }));
  const allValues = series.flatMap((entry) => entry.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const scaleX = (index, count) => 16 + (index / Math.max(1, count - 1)) * 196;
  const scaleY = (value) => 82 - ((value - min) / range) * 64;
  return `
    <div class="picklist-compare-chart-shell">
      <svg class="trend-chart compare-trend-chart" viewBox="0 0 220 100" role="img" aria-label="${escapeAttribute(`${metric.label} comparison by match number`)}" width="100%" height="280">
        <line x1="16" y1="82" x2="212" y2="82" stroke="var(--line)" stroke-width="1"></line>
        <line x1="16" y1="18" x2="16" y2="82" stroke="var(--line)" stroke-width="1"></line>
        <g class="compare-trend-grid">
          ${Array.from({ length: 5 }, (_, index) => {
            const x = 16 + (index / 4) * 196;
            return `<line x1="${x}" y1="18" x2="${x}" y2="82"></line>`;
          }).join("")}
        </g>
        <text x="114" y="97" text-anchor="middle">Match Number</text>
        <text x="4" y="50" text-anchor="middle" transform="rotate(-90 4 50)">${metric.label} (${metric.unit})</text>
        <text x="14" y="20" text-anchor="end">${max.toFixed(metric.unit === "%" ? 0 : 1)}</text>
        <text x="14" y="84" text-anchor="end">${min.toFixed(metric.unit === "%" ? 0 : 1)}</text>
        ${series
          .map((entry) => {
            const points = entry.values.map((value, index) => `${scaleX(index, entry.values.length)},${scaleY(value)}`).join(" ");
            return `<polyline points="${points}" fill="none" stroke="${entry.color}" stroke-width="2.6" vector-effect="non-scaling-stroke"></polyline>`;
          })
          .join("")}
        ${series
          .map((entry) =>
            entry.values
              .map((value, index) => {
                const x = scaleX(index, entry.values.length);
                const y = scaleY(value);
                return `<circle cx="${x}" cy="${y}" r="2.5" fill="${entry.color}"><title>Team ${entry.team.number}, Match ${index + 1}: ${value.toFixed(metric.unit === "%" ? 0 : 1)} ${metric.unit}</title></circle>`;
              })
              .join(""),
          )
          .join("")}
      </svg>
      <div class="picklist-compare-legend">
        ${selectedTeams
          .map((team) => {
            const slot = compareSlotIndexForTeam(team.number);
            const accent = compareAccent(team.number) || "var(--accent)";
            return `
              <button class="compare-team-chip" data-remove-compare-team="${team.number}" style="--compare-accent: ${accent}">
                <span class="compare-team-swatch">${slot + 1}</span>
                <span>${team.number} ${team.name}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderCriteriaTerm(term, index, count) {
  const source = criteriaSources.find((item) => item.id === term.source) || criteriaSources[0];
  return `
    <div class="criteria-term">
      ${index === 0 ? `<span class="operator-spacer"></span>` : `
        <select class="term-operator" data-term-index="${index}" aria-label="Operator for component ${index + 1}">
          <option value="+" ${term.operator === "+" ? "selected" : ""}>+</option>
          <option value="-" ${term.operator === "-" ? "selected" : ""}>-</option>
          <option value="remove">Remove</option>
        </select>
      `}
      <label>
        Weight
        <input class="term-weight" data-term-index="${index}" type="number" min="-99" max="99" step="0.1" value="${Number(term.weight).toFixed(1)}" />
      </label>
      <label>
        Data source
        <select class="term-source" data-term-index="${index}">
          ${criteriaSources.map((item) => `<option value="${item.id}" ${item.id === term.source ? "selected" : ""}>${item.label}</option>`).join("")}
        </select>
      </label>
      <label>
        Component
        <select class="term-component" data-term-index="${index}">
          ${source.components.map((component) => `<option value="${component.id}" ${component.id === term.component ? "selected" : ""}>${component.label}</option>`).join("")}
        </select>
      </label>
      ${index === count - 1 && count < 5 ? `<button class="icon-button add-term-button" id="addCriteriaTerm" title="Add component" aria-label="Add component">+</button>` : `<span class="operator-spacer"></span>`}
    </div>
  `;
}

function renderEntityListItem(kind, item, index, selected) {
  const rename = state.inlineRename?.kind === kind && state.inlineRename?.id === item.id;
  const protectedItem = kind === "sortEquation" && isProtectedSortEquation(item);
  return `
    <div
      class="builder-list-item ${selected ? "active" : ""} ${protectedItem ? "locked" : ""}"
      data-entity-row="${kind}:${item.id}"
      data-entity-kind="${kind}"
      data-entity-id="${item.id}"
      data-entity-index="${index}"
      draggable="${protectedItem ? "false" : "true"}"
      tabindex="-1"
    >
      ${
        rename
          ? `<input class="inline-rename-input" data-inline-rename="${kind}:${item.id}" value="${escapeAttribute(state.inlineRename.value)}" autocomplete="off" />`
          : `<span>${protectedItem ? `${icon("lock")} ${item.name}` : item.name}</span>`
      }
    </div>
  `;
}

function renderTeamTile(team, index, options = {}) {
  const classes = ["picklist-tile"];
  if (options.compact) classes.push("compact");
  if (options.focused) classes.push("team-focused");
  if (options.compareIndex >= 0) classes.push("compare-selected");
  if (options.extraClass) classes.push(options.extraClass);
  const scoreMarkup = options.showScore ? `<span class="tile-score">${Number(options.score || 0).toFixed(1)}</span>` : `<span class="tile-spacer"></span>`;
  const background = options.showScore ? colorForScore(Number(options.score || 0), Number(options.minScore || 0), Number(options.maxScore || 0)) : "transparent";
  const compareColor = options.compareIndex >= 0 ? compareTeamPalette[options.compareIndex] : "";
  const style = [`background: ${background}`];
  if (compareColor) style.push(`--compare-accent: ${compareColor}`);
  return `
    <button
      class="${classes.join(" ")}"
      ${options.dataAttribute || ""}
      ${options.dragData ? `data-drag-team="${options.dragData}"` : ""}
      ${options.builderTeam ? `data-builder-team="${team.number}"` : ""}
      ${options.reorderTeam ? `data-reorder-team="${team.number}"` : ""}
      draggable="${options.draggable ? "true" : "false"}"
      style="${style.join("; ")}"
    >
      <strong class="tile-rank">${index + 1}</strong>
      <span class="tile-label">${options.showName === false ? team.number : `${team.number} ${team.name}`}</span>
      ${scoreMarkup}
    </button>
  `;
}

function renderBuilderTeamTile(team, index, options = {}) {
  const focused = state.picklistSelectedTeam === team.number;
  return renderTeamTile(team, index, {
    compact: true,
    showName: false,
    showScore: false,
    focused,
    compareIndex: compareSlotIndexForTeam(team.number),
    builderTeam: true,
    reorderTeam: options.draggable,
    draggable: Boolean(options.draggable),
    dragData: options.draggable ? String(team.number) : "",
  });
}

function gridColumnModel(entry) {
  if (!entry) return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
  const [type, id] = entry.split(":");
  if (type === "sort") {
    const equation = state.sortEquations.find((item) => item.id === id);
    if (!equation) return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
    const rankedTeams = rankTeamsByEquation(equation).map((number) => teamByNumber(number)).filter(Boolean);
    const scores = rankedTeams.map((team) => scoreTeamByEquation(team, equation));
    return {
      type,
      id,
      label: equation.name,
      teams: rankedTeams,
      scores,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    };
  }
  if (type === "picklist") {
    const picklist = state.picklists.find((item) => item.id === id);
    if (!picklist) return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
    return {
      type,
      id,
      label: picklist.name,
      teams: picklist.teams.map((number) => teamByNumber(number)).filter(Boolean),
      minScore: 0,
      maxScore: 0,
    };
  }
  return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
}

function renderPicklistGridColumn(entry, index) {
  const column = gridColumnModel(entry);
  const minHeight = `calc(${teams.length} * var(--picklist-tile-row-size))`;
  return `
    <section class="grid-column ${column.type ? "" : "empty"}" ${column.type ? `data-grid-column="${index}"` : ""}>
      <label class="grid-column-select">
        <span>Column ${index + 1}</span>
        <select data-picklist-column="${index}">
          <option value="" ${entry ? "" : "selected"}>---</option>
          <optgroup label="Sort Equations">
            ${state.sortEquations.map((item) => `<option value="sort:${item.id}" ${entry === `sort:${item.id}` ? "selected" : ""}>${item.name}</option>`).join("")}
          </optgroup>
          <optgroup label="Picklists">
            ${state.picklists.map((item) => `<option value="picklist:${item.id}" ${entry === `picklist:${item.id}` ? "selected" : ""}>${item.name}</option>`).join("")}
          </optgroup>
        </select>
      </label>
      <div class="grid-column-list" style="min-height: ${minHeight}">
        ${
          column.teams.length
            ? column.teams
                .map((team, teamIndex) => {
                  const compareIndex = compareSlotIndexForTeam(team.number);
                  return column.type === "sort"
                    ? renderTeamTile(team, teamIndex, {
                        compact: true,
                        showName: false,
                        showScore: true,
                        score: column.scores[teamIndex],
                        minScore: column.minScore,
                        maxScore: column.maxScore,
                        compareIndex,
                        builderTeam: true,
                      })
                    : renderTeamTile(team, teamIndex, {
                        compact: true,
                        showName: false,
                        showScore: false,
                        compareIndex,
                      });
                })
                .join("")
            : `<div class="empty-state compact-empty">Column is empty.</div>`
        }
      </div>
    </section>
  `;
}

function renderContextMenu() {
  if (!state.contextMenu || state.contextMenu.type === "board") return "";
  if (state.contextMenu.type === "grid-column") {
    return `
      <div class="context-menu" style="left: ${state.contextMenu.x}px; top: ${state.contextMenu.y}px;">
        <button data-copy-grid-column="${state.contextMenu.columnIndex}">Copy to current picklist</button>
      </div>
    `;
  }
  if (state.contextMenu.type !== "entity") return "";
  const collection = state.contextMenu.entityKind === "sortEquation" ? state.sortEquations : state.picklists;
  const item = collection.find((entry) => entry.id === state.contextMenu.id);
  const locked = state.contextMenu.entityKind === "sortEquation" && isProtectedSortEquation(item);
  const canDelete = !locked && isAdmin() && collection.length > 1;
  return `
    <div class="context-menu" style="left: ${state.contextMenu.x}px; top: ${state.contextMenu.y}px;">
      ${state.contextMenu.entityKind === "sortEquation" ? `<button data-context-duplicate="${state.contextMenu.id}">Duplicate</button>` : ""}
      <button data-context-rename="${state.contextMenu.entityKind}:${state.contextMenu.id}" ${locked ? "disabled" : ""}>Rename</button>
      <button data-context-delete="${state.contextMenu.entityKind}:${state.contextMenu.id}" ${canDelete ? "" : "disabled"}>Delete</button>
    </div>
  `;
}

function renderPicklistTile(number, index, picklist, options = {}) {
  const team = teamByNumber(number);
  if (!team) return "";
  const picked = pickedTeams().includes(number) ? "picked" : "";
  const content = options.static && !options.showScore
    ? renderTeamTile(team, index, {
        compact: true,
        showName: false,
        showScore: false,
        extraClass: picked,
        draggable: !picked,
        dragData: picked ? "" : String(team.number),
        dataAttribute: options.navigation ? `data-team="${team.number}"` : "",
      })
    : renderTeamTile(team, index, {
        compact: true,
        showName: false,
        showScore: Boolean(options.showScore),
        score: options.score,
        minScore: options.minScore,
        maxScore: options.maxScore,
        extraClass: picked,
        draggable: !picked,
        dragData: picked ? "" : String(team.number),
        dataAttribute: options.navigation ? `data-team="${team.number}"` : "",
      });
  return content;
}

function renderAlliance() {
  const loaded = state.loadedSources.map((entry) => gridColumnModel(entry)).filter((column) => column.teams.length);
  const headerLines = Math.max(1, ...loaded.map((column) => Math.ceil(column.label.length / 14)));
  return `
    <div class="grid alliance-layout">
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Selection Board</h2>
          </div>
        </div>
        <div class="board">
          ${state.allianceBoard.map((teamNumber, index) => renderBoardCell(teamNumber, index)).join("")}
        </div>
        ${renderBoardContextMenu()}
        <div class="section-heading">
          <div>
            <h2>Picklist Selector</h2>
          </div>
        </div>
        <div class="picklist-loader">
          <div class="picklist-loader-group">
            <h3>Sort Equations</h3>
            ${state.sortEquations
              .map(
                (equation) => `
            <label class="check-row">
              <input type="checkbox" class="picklist-check" value="sort:${equation.id}" ${state.loadedSources.includes(`sort:${equation.id}`) ? "checked" : ""} />
              <span>${equation.name}</span>
              <span class="muted">${isProtectedSortEquation(equation) ? "Protected source" : "Scored source"}</span>
            </label>
          `,
              )
              .join("")}
          </div>
          <div class="picklist-loader-group">
            <h3>Picklists</h3>
            ${state.picklists
              .map(
                (picklist) => `
              <label class="check-row">
                <input type="checkbox" class="picklist-check" value="picklist:${picklist.id}" ${state.loadedSources.includes(`picklist:${picklist.id}`) ? "checked" : ""} />
                <span>${picklist.name}</span>
                <span class="muted">Manual order</span>
              </label>
            `,
              )
              .join("")}
          </div>
        </div>
      </article>
      <article class="card alliance-sources-card">
        <div class="section-heading">
          <div>
            <h2>Displayed Sources</h2>
          </div>
        </div>
        <div class="picklist-columns alliance-picklists" style="--alliance-header-lines: ${headerLines}">
          ${
            loaded.length
              ? loaded
                  .map(
                    (column) => `
              <section>
                <h3>${column.label}</h3>
                <div class="alliance-source-list">
                  ${column.teams
                    .map((team, teamIndex) =>
                      renderPicklistTile(team.number, teamIndex, null, {
                        static: true,
                        navigation: false,
                        showScore: column.type === "sort",
                        score: column.scores?.[teamIndex],
                        minScore: column.minScore,
                        maxScore: column.maxScore,
                      }),
                    )
                    .join("")}
                </div>
              </section>
            `,
                  )
                  .join("")
              : `<div class="empty-state">Select one or more sources to load them here.</div>`
          }
        </div>
      </article>
    </div>
  `;
}

function renderBoardCell(teamNumber, index) {
  if (teamNumber) {
    const team = teamByNumber(teamNumber);
    return `
      <div class="board-cell occupied" data-board-cell="${index}" data-board-team="${teamNumber}" title="Right-click to remove ${teamNumber}">
        <strong>${teamNumber}</strong>
        <span>${team?.name || ""}</span>
      </div>
    `;
  }
  return `
    <div class="board-cell empty" data-board-cell="${index}">
      <input class="board-input" data-board-input="${index}" inputmode="numeric" placeholder="Team #" aria-label="Alliance slot ${index + 1}" />
    </div>
  `;
}

function renderBoardContextMenu() {
  if (!state.contextMenu || state.contextMenu.type !== "board") return "";
  const teamNumber = state.allianceBoard[state.contextMenu.cell];
  if (!teamNumber) return "";
  return `
    <div class="context-menu" style="left: ${state.contextMenu.x}px; top: ${state.contextMenu.y}px;">
      <button class="context-remove" data-remove-cell="${state.contextMenu.cell}">Remove ${teamNumber}</button>
    </div>
  `;
}

function renderAdmin() {
  return `
    <div class="grid">
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Data Sources</h2>
            <p class="muted">This demo shows the intended source boundaries while using seeded local data.</p>
          </div>
          <button>Refresh demo data</button>
        </div>
        <div class="data-source-list">
          ${dataSources
            .map(
              (source) => `
            <div class="data-source-row">
              <div>
                <strong>${source.name}</strong>
                <span class="muted">${source.notes}</span>
              </div>
              <span class="source-status">${source.status}</span>
              <span class="muted">${source.updated}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </article>
      <div class="stat-grid">
        <div class="stat"><span>Teams</span><strong>${teams.length}</strong></div>
        <div class="stat"><span>Matches</span><strong>${matches.length}</strong></div>
        <div class="stat"><span>Picklists</span><strong>${state.picklists.length}</strong></div>
        <div class="stat"><span>Admin Users</span><strong>${adminUsers.length}</strong></div>
      </div>
      <div class="grid cols-2">
        <article class="card">
          <h2>Import Contract</h2>
          <p class="muted">Scouting rows should include event, match, team, scout, raw scoring fields, defense indicators, robot status, and notes.</p>
          <button>Import scouting data</button>
        </article>
        <article class="card">
          <h2>External Sync</h2>
          <p class="muted">TBA, Statbotics, and pRidge are modeled as refreshable sources for the eventual backend.</p>
          <button>Refresh metrics</button>
        </article>
      </div>
    </div>
  `;
}

function renderFlags(flags) {
  if (!flags.length) return "";
  return `<span class="flag-list">${flags.map((flag) => `<span class="flag ${flag.severity}">${flag.label}</span>`).join("")}</span>`;
}

function renderTeamBadges(team) {
  const drivetrainFlags = team.drivetrain === "swerve" ? [] : [{ label: "Non-Swerve", severity: "danger" }];
  return renderFlags([...drivetrainFlags, ...team.flags]);
}

function placeTeamOnBoard(teamNumber, cellIndex) {
  const number = Number(teamNumber);
  if (!teamByNumber(number) || state.allianceBoard[cellIndex] || pickedTeams().includes(number)) return false;
  state.allianceBoard[cellIndex] = number;
  state.contextMenu = null;
  saveState();
  render();
  return true;
}

function removeTeamFromBoard(cellIndex) {
  state.allianceBoard[cellIndex] = null;
  state.contextMenu = null;
  saveState();
  render();
}

function uniqueEntityName(baseName, items, fallback) {
  const base = (baseName || "").trim() || fallback;
  const names = new Set(items.map((item) => item.name));
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function moveItemBefore(values, draggedValue, targetValue) {
  const next = values.filter((value) => value !== draggedValue);
  const targetIndex = next.indexOf(targetValue);
  next.splice(targetIndex < 0 ? next.length : targetIndex, 0, draggedValue);
  return next;
}

function moveItemByStep(values, value, step) {
  const index = values.indexOf(value);
  if (index < 0) return values;
  const targetIndex = Math.max(0, Math.min(values.length - 1, index + step));
  if (targetIndex === index) return values;
  const next = [...values];
  next.splice(index, 1);
  next.splice(targetIndex, 0, value);
  return next;
}

function firstVisibleGridColumn() {
  return state.picklistColumns.map((entry, index) => ({ entry, index })).find((item) => item.entry);
}

function defaultTeamsForNewPicklist() {
  const firstColumn = firstVisibleGridColumn();
  if (!firstColumn) return rankTeamsByEquation(state.sortEquations[0]);
  return gridColumnModel(firstColumn.entry).teams.map((team) => team.number);
}

function removePicklist(id) {
  if (state.picklists.length <= 1) return;
  const nextPicklists = state.picklists.filter((picklist) => picklist.id !== id);
  state.picklists = nextPicklists;
  state.activePicklist = nextPicklists[Math.min(nextPicklists.length - 1, nextPicklists.findIndex((picklist) => picklist.id === state.activePicklist))]?.id || nextPicklists[0].id;
  state.loadedSources = state.loadedSources.filter((entry) => entry !== `picklist:${id}`);
  if (!state.loadedSources.length) state.loadedSources = [`picklist:${nextPicklists[0].id}`];
  state.picklistColumns = state.picklistColumns.map((entry) => (entry === `picklist:${id}` ? "" : entry));
  if (state.contextMenu?.id === id) state.contextMenu = null;
  saveState();
  render();
}

function removeSortEquation(id) {
  if (id === protectedEpaSortId || state.sortEquations.length <= 1) return;
  const nextEquations = state.sortEquations.filter((equation) => equation.id !== id);
  state.sortEquations = nextEquations;
  state.activeSortEquation = nextEquations[Math.min(nextEquations.length - 1, nextEquations.findIndex((equation) => equation.id === state.activeSortEquation))]?.id || nextEquations[0].id;
  state.metric = state.metric === `sort:${id}` ? "epa" : state.metric;
  state.loadedSources = state.loadedSources.filter((entry) => entry !== `sort:${id}`);
  state.picklistColumns = state.picklistColumns.map((entry) => (entry === `sort:${id}` ? "" : entry));
  if (state.contextMenu?.id === id) state.contextMenu = null;
  saveState();
  render();
}

function renamePicklist(id, requestedName) {
  const picklist = state.picklists.find((item) => item.id === id);
  if (!picklist) return;
  const trimmed = requestedName.trim();
  if (!trimmed || trimmed === picklist.name) return;
  const name = uniqueEntityName(trimmed, state.picklists.filter((item) => item.id !== id), trimmed);
  state.picklists = state.picklists.map((item) => (item.id === id ? { ...item, name } : item));
  saveState();
  render();
}

function renameSortEquation(id, requestedName) {
  const equation = state.sortEquations.find((item) => item.id === id);
  if (!equation || isProtectedSortEquation(equation)) return;
  const trimmed = requestedName.trim();
  if (!trimmed || trimmed === equation.name) return;
  const name = uniqueEntityName(trimmed, state.sortEquations.filter((item) => item.id !== id), trimmed);
  state.sortEquations = state.sortEquations.map((item) => (item.id === id ? { ...item, name } : item));
  saveState();
  render();
}

function duplicateSortEquation(id) {
  const equation = state.sortEquations.find((item) => item.id === id);
  if (!equation) return;
  const baseName = isProtectedSortEquation(equation) ? "EPA Copy" : `${equation.name} Copy`;
  const name = uniqueEntityName(baseName, state.sortEquations, baseName);
  const duplicate = {
    id: createId("sort"),
    name,
    terms: normalizeCriteriaTerms(equation.metricId ? defaultCriteriaTerms : equation.terms),
    locked: false,
  };
  state.sortEquations = [...state.sortEquations, duplicate];
  state.activeSortEquation = duplicate.id;
  state.builderFocus.sortBuilder = "list";
  saveState();
  render();
}

function startInlineRename(kind, id) {
  const collection = kind === "sortEquation" ? state.sortEquations : state.picklists;
  const item = collection.find((entry) => entry.id === id);
  if (!item || (kind === "sortEquation" && isProtectedSortEquation(item))) return;
  state.inlineRename = { kind, id, value: item.name };
  render();
}

function commitInlineRename() {
  if (!state.inlineRename) return;
  const { kind, id, value } = state.inlineRename;
  state.inlineRename = null;
  if (kind === "sortEquation") renameSortEquation(id, value);
  else renamePicklist(id, value);
}

function cancelInlineRename() {
  if (!state.inlineRename) return;
  state.inlineRename = null;
  render();
}

function handleBuilderKeyboard(event) {
  if (state.inlineRename) return;
  const target = event.target;
  if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

  if (event.key === "F2") {
    if (state.activeView === "sortBuilder" && state.activeSortEquation && !isProtectedSortEquation(activeSortEquation())) {
      event.preventDefault();
      startInlineRename("sortEquation", state.activeSortEquation);
    }
    if (state.activeView === "picklistBuilder" && state.activePicklist) {
      event.preventDefault();
      startInlineRename("picklist", state.activePicklist);
    }
    return;
  }

  if (state.activeView === "sortBuilder") {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const index = state.sortEquations.findIndex((item) => item.id === state.activeSortEquation);
      const next = state.sortEquations[Math.max(0, Math.min(state.sortEquations.length - 1, index + direction))];
      if (!next) return;
      state.activeSortEquation = next.id;
      saveState();
      render();
    }
    return;
  }

  if (state.activeView !== "picklistBuilder") return;

  const currentPicklist = activePicklist();
  if (event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && state.picklistSelectedTeam) {
    event.preventDefault();
    const nextTeams = moveItemByStep(currentPicklist.teams, state.picklistSelectedTeam, event.key === "ArrowUp" ? -1 : 1);
    updatePicklist(currentPicklist.id, (picklist) => ({ ...picklist, teams: nextTeams }));
    return;
  }

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    if (state.builderFocus.picklistBuilder === "teams" && state.picklistSelectedTeam) {
      const index = currentPicklist.teams.indexOf(state.picklistSelectedTeam);
      const nextIndex = Math.max(0, Math.min(currentPicklist.teams.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)));
      state.picklistSelectedTeam = currentPicklist.teams[nextIndex] || null;
      render();
      return;
    }
    const index = state.picklists.findIndex((item) => item.id === state.activePicklist);
    const next = state.picklists[Math.max(0, Math.min(state.picklists.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)))];
    if (!next) return;
    state.activePicklist = next.id;
    state.builderFocus.picklistBuilder = "list";
    saveState();
    render();
  }
}

function bindViewEvents() {
  document.querySelector("#metricSelect")?.addEventListener("change", (event) => {
    state.metric = event.target.value;
    saveState();
    render();
  });
  document.querySelector("#teamDetailMetricSelect")?.addEventListener("change", (event) => {
    state.teamDetailMetric = normalizeTeamDetailMetric(event.target.value);
    saveState();
    render();
  });
  document.querySelector("#picklistCompareMetricSelect")?.addEventListener("change", (event) => {
    state.picklistCompareMetric = normalizeTeamDetailMetric(event.target.value);
    saveState();
    render();
  });
  document.querySelector("#teamSelect")?.addEventListener("change", (event) => {
    state.selectedTeam = Number(event.target.value);
    state.activeView = "teamDetail";
    saveState();
    render();
  });
  document.querySelectorAll("[data-team], [data-team-link]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedTeam = Number(element.dataset.team || element.dataset.teamLink);
      state.activeView = "teamDetail";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-match]").forEach((element) => {
    element.addEventListener("click", () => {
      state.selectedMatch = Number(element.dataset.match);
      state.activeView = "matchup";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-match-nav]").forEach((element) => {
    element.addEventListener("click", () => {
      if (!element.dataset.matchNav) return;
      state.selectedMatch = Number(element.dataset.matchNav);
      state.activeView = "matchup";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-match-row]").forEach((element) => {
    element.addEventListener("click", () => {
      state.selectedMatch = Number(element.dataset.matchRow);
      state.activeView = "matchup";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-drag-team]").forEach((element) => {
    element.addEventListener("dragstart", (event) => {
      const teamNumber = element.dataset.dragTeam;
      if (pickedTeams().includes(Number(teamNumber))) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData("text/plain", teamNumber);
      event.dataTransfer.effectAllowed = "copy";
    });
  });
  document.querySelectorAll("[data-board-cell]").forEach((cell) => {
    const cellIndex = Number(cell.dataset.boardCell);
    cell.addEventListener("dragover", (event) => {
      if (!state.allianceBoard[cellIndex]) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    });
    cell.addEventListener("drop", (event) => {
      event.preventDefault();
      placeTeamOnBoard(event.dataTransfer.getData("text/plain"), cellIndex);
    });
    cell.addEventListener("contextmenu", (event) => {
      if (!state.allianceBoard[cellIndex]) return;
      event.preventDefault();
      state.contextMenu = { type: "board", cell: cellIndex, x: event.clientX, y: event.clientY };
      render();
    });
  });
  document.querySelectorAll("[data-board-input]").forEach((input) => {
    const cellIndex = Number(input.dataset.boardInput);
    const submit = () => {
      const value = input.value.trim();
      if (value) placeTeamOnBoard(value, cellIndex);
    };
    input.addEventListener("change", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });
  });
  document.querySelectorAll("[data-remove-cell]").forEach((button) => {
    button.addEventListener("click", () => removeTeamFromBoard(Number(button.dataset.removeCell)));
  });
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest(".context-menu")) return;
      if (!state.contextMenu) return;
      state.contextMenu = null;
      render();
    },
    { once: true },
  );
  document.querySelectorAll(".picklist-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.loadedSources = Array.from(document.querySelectorAll(".picklist-check:checked"))
        .map((input) => normalizeSourceEntry(input.value))
        .filter(Boolean);
      saveState();
      render();
    });
  });
  document.querySelector("#addPicklistButton")?.addEventListener("click", () => {
    const name = uniqueEntityName("Picklist", state.picklists, "Picklist");
    const picklist = { id: createId("pick"), name, teams: defaultTeamsForNewPicklist() };
    state.picklists = [...state.picklists, picklist];
    state.activePicklist = picklist.id;
    state.builderFocus.picklistBuilder = "list";
    saveState();
    render();
  });
  document.querySelector("#addSortEquationButton")?.addEventListener("click", () => {
    const name = uniqueEntityName("Sort Equation", state.sortEquations, "Sort Equation");
    const equation = { id: createId("sort"), name, terms: normalizeCriteriaTerms(defaultCriteriaTerms) };
    state.sortEquations = [...state.sortEquations, equation];
    state.activeSortEquation = equation.id;
    state.builderFocus.sortBuilder = "list";
    saveState();
    render();
  });
  document.querySelectorAll("[data-entity-row]").forEach((row) => {
    row.addEventListener("click", () => {
      const kind = row.dataset.entityKind;
      const id = row.dataset.entityId;
      if (kind === "sortEquation") {
        state.activeSortEquation = id;
        state.builderFocus.sortBuilder = "list";
      } else {
        state.activePicklist = id;
        state.builderFocus.picklistBuilder = "list";
      }
      saveState();
      render();
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      state.contextMenu = {
        type: "entity",
        entityKind: row.dataset.entityKind,
        id: row.dataset.entityId,
        x: event.clientX,
        y: event.clientY,
      };
      render();
    });
    row.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/x-entity-row", row.dataset.entityRow);
      event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = event.dataTransfer.getData("application/x-entity-row");
      const [kind, draggedId] = payload.split(":");
      if (!draggedId || kind !== row.dataset.entityKind || draggedId === row.dataset.entityId) return;
      if (kind === "sortEquation") {
        if (draggedId === protectedEpaSortId || row.dataset.entityId === protectedEpaSortId) return;
        state.sortEquations = moveItemBefore(state.sortEquations, state.sortEquations.find((item) => item.id === draggedId), state.sortEquations.find((item) => item.id === row.dataset.entityId));
      } else {
        state.picklists = moveItemBefore(state.picklists, state.picklists.find((item) => item.id === draggedId), state.picklists.find((item) => item.id === row.dataset.entityId));
      }
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-context-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      const [kind, id] = button.dataset.contextRename.split(":");
      startInlineRename(kind, id);
    });
  });
  document.querySelectorAll("[data-context-duplicate]").forEach((button) => {
    button.addEventListener("click", () => duplicateSortEquation(button.dataset.contextDuplicate));
  });
  document.querySelectorAll("[data-context-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!isAdmin()) return;
      const [kind, id] = button.dataset.contextDelete.split(":");
      const collection = kind === "sortEquation" ? state.sortEquations : state.picklists;
      const item = collection.find((entry) => entry.id === id);
      if (!item) return;
      const label = kind === "sortEquation" ? "sort equation" : "picklist";
      if (!confirm(`Remove ${label} "${item.name}"? This cannot be undone.`)) return;
      if (kind === "sortEquation") removeSortEquation(id);
      else removePicklist(id);
    });
  });
  document.querySelector("#addCriteriaTerm")?.addEventListener("click", () => {
    const equation = activeSortEquation();
    if (isProtectedSortEquation(equation)) return;
    if (equation.terms.length >= 5) return;
    const terms = normalizeCriteriaTerms([...equation.terms, { operator: "+", weight: 1, source: "epa", component: "total" }]);
    updateSortEquation(equation.id, (current) => ({ ...current, terms }));
  });
  document.querySelectorAll(".term-weight, .term-operator, .term-source, .term-component").forEach((control) => {
    const updateTerm = () => {
      const equation = activeSortEquation();
      if (isProtectedSortEquation(equation)) return;
      const termIndex = Number(control.dataset.termIndex);
      if (control.classList.contains("term-operator") && control.value === "remove") {
        const terms = normalizeCriteriaTerms(equation.terms).filter((_, index) => index !== termIndex);
        updateSortEquation(equation.id, (current) => ({ ...current, terms }));
        return;
      }
      const terms = normalizeCriteriaTerms(equation.terms).map((term, index) => {
        if (index !== termIndex) return term;
        if (control.classList.contains("term-weight")) return { ...term, weight: Number(control.value) || 0 };
        if (control.classList.contains("term-operator")) return { ...term, operator: control.value };
        if (control.classList.contains("term-source")) {
          const source = criteriaSources.find((item) => item.id === control.value) || criteriaSources[0];
          return { ...term, source: source.id, component: source.components[0].id };
        }
        return { ...term, component: control.value };
      });
      updateSortEquation(equation.id, (current) => ({ ...current, terms }));
    };
    control.addEventListener("change", updateTerm);
    if (control.classList.contains("term-weight")) control.addEventListener("input", updateTerm);
  });
  document.querySelectorAll("[data-inline-rename]").forEach((input) => {
    input.focus();
    input.select();
    input.addEventListener("input", () => {
      if (!state.inlineRename) return;
      state.inlineRename.value = input.value;
    });
    input.addEventListener("blur", commitInlineRename);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") commitInlineRename();
      if (event.key === "Escape") cancelInlineRename();
      event.stopPropagation();
    });
  });
  document.querySelectorAll("[data-picklist-column]").forEach((select) => {
    select.addEventListener("change", () => {
      state.picklistColumns[Number(select.dataset.picklistColumn)] = select.value;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-grid-column]").forEach((column) => {
    column.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      state.contextMenu = { type: "grid-column", columnIndex: Number(column.dataset.gridColumn), x: event.clientX, y: event.clientY };
      render();
    });
  });
  document.querySelectorAll("[data-copy-grid-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const column = gridColumnModel(state.picklistColumns[Number(button.dataset.copyGridColumn)]);
      const picklist = activePicklist();
      if (!column.teams.length) return;
      if (!confirm(`Replace "${picklist.name}" with "${column.label}"?`)) return;
      updatePicklist(picklist.id, (current) => ({ ...current, teams: column.teams.map((team) => team.number) }));
    });
  });
  document.querySelectorAll("[data-builder-team]").forEach((tile) => {
    tile.addEventListener("click", () => {
      const teamNumber = Number(tile.dataset.builderTeam);
      const wasCompared = compareSlotIndexForTeam(teamNumber) >= 0;
      const changed = togglePicklistCompareTeam(teamNumber);
      if (!changed) return;
      state.builderFocus.picklistBuilder = "teams";
      state.picklistSelectedTeam = wasCompared && state.picklistSelectedTeam === teamNumber ? null : teamNumber;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-remove-compare-team]").forEach((button) => {
    button.addEventListener("click", () => {
      const teamNumber = Number(button.dataset.removeCompareTeam);
      const changed = togglePicklistCompareTeam(teamNumber);
      if (!changed) return;
      if (state.picklistSelectedTeam === teamNumber) state.picklistSelectedTeam = null;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-reorder-team]").forEach((tile) => {
    tile.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/x-picklist-team", tile.dataset.reorderTeam);
      event.dataTransfer.effectAllowed = "move";
    });
    tile.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedTeam = Number(event.dataTransfer.getData("application/x-picklist-team"));
      const targetTeam = Number(tile.dataset.reorderTeam);
      if (!draggedTeam || draggedTeam === targetTeam) return;
      const picklist = activePicklist();
      updatePicklist(picklist.id, (current) => ({ ...current, teams: moveItemBefore(current.teams, draggedTeam, targetTeam) }));
    });
  });
  document.onkeydown = handleBuilderKeyboard;
}
