(function attachPairwisePicklist(global) {
  const keyFor = (higher, lower) => `${higher}:${lower}`;
  const boundaryKeys = (teams, rankLimit) => teams.slice(0, Math.min(teams.length - 1, rankLimit)).map((team, index) => keyFor(team, teams[index + 1]));
  const refresh = (state, teams) => {
    const visible = new Set(boundaryKeys(teams, state.rankLimit));
    const reviewed = new Set([...state.reviewed].filter((key) => visible.has(key)));
    const unresolved = new Set([...state.unresolved].filter((key) => visible.has(key) && !reviewed.has(key)));
    for (const key of visible) if (!reviewed.has(key) && !unresolved.has(key)) unresolved.add(key);
    return { reviewed, unresolved };
  };
  const suggestions = (state, limit = 3) => boundaryKeys(state.teams, state.rankLimit).filter((key) => state.unresolved.has(key)).slice(0, limit).flatMap((key) => key.split(":").map(Number));
  function create(teams, rankLimit = Math.min(24, teams.length - 1)) {
    return { teams: [...teams], rankLimit, cursorIndex: 0, mode: "select", activeTeam: null, comparedTeam: null, compareAbove: false, compareBelow: false, reviewed: new Set(), unresolved: new Set(boundaryKeys(teams, rankLimit)), placementStart: null };
  }
  function choose(state, team) {
    if (state.mode !== "select") return state;
    const cursorIndex = state.teams.indexOf(team);
    return cursorIndex < 0 ? state : { ...state, cursorIndex };
  }
  function moveCursor(state, direction) {
    return state.mode !== "select" ? state : { ...state, cursorIndex: Math.max(0, Math.min(state.teams.length - 1, state.cursorIndex + direction)) };
  }
  function begin(state) {
    if (state.mode !== "select") return state;
    const activeTeam = state.teams[state.cursorIndex];
    return { ...state, mode: "sort", activeTeam, comparedTeam: null, placementStart: { teams: [...state.teams], cursorIndex: state.cursorIndex, reviewed: new Set(state.reviewed), unresolved: new Set(state.unresolved) } };
  }
  function setComparisonModifiers(state, { above, below }) {
    return { ...state, compareAbove: Boolean(above), compareBelow: Boolean(below) };
  }
  function move(state, direction) {
    if (state.mode !== "sort") return state;
    const index = state.teams.indexOf(state.activeTeam);
    const target = index + direction;
    if (target < 0 || target >= state.teams.length) return state;
    const teams = [...state.teams];
    [teams[index], teams[target]] = [teams[target], teams[index]];
    // The next decision is always against the team directly above the active team;
    // at rank 1, present the team below instead.
    const comparedTeam = teams[target - 1] ?? teams[target + 1] ?? null;
    return { ...state, teams, cursorIndex: target, comparedTeam, ...refresh(state, teams) };
  }
  function finish(state) {
    if (state.mode !== "sort") return state;
    const index = state.teams.indexOf(state.activeTeam);
    const visible = new Set(boundaryKeys(state.teams, state.rankLimit));
    const reviewed = new Set(state.reviewed);
    [keyFor(state.teams[index - 1], state.teams[index]), keyFor(state.teams[index], state.teams[index + 1])].forEach((key) => { if (visible.has(key)) reviewed.add(key); });
    const next = { ...state, reviewed, unresolved: new Set([...state.unresolved].filter((key) => !reviewed.has(key))), mode: "select", activeTeam: null, comparedTeam: null, placementStart: null };
    // Keep the cursor on the team just placed; suggestions remain gray hints only.
    return { ...next, cursorIndex: next.cursorIndex, compareAbove: false, compareBelow: false };
  }
  function cancel(state) {
    return state.mode !== "sort" ? state : { ...state, ...state.placementStart, mode: "select", activeTeam: null, comparedTeam: null, compareAbove: false, compareBelow: false, placementStart: null };
  }
  global.PairwisePicklist = { create, choose, moveCursor, begin, setComparisonModifiers, move, finish, cancel, suggestions };
}(globalThis));
