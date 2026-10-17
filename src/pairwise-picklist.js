(function attachPairwisePicklist(global) {
  function create(teams) {
    return { teams: [...teams], cursorIndex: 0, mode: "select", activeTeam: null, comparedTeam: null, compareAbove: false, compareBelow: false, placementStart: null };
  }
  function choose(state, team) {
    if (state.mode !== "select") return state;
    const cursorIndex = state.teams.indexOf(team);
    return cursorIndex < 0 ? state : { ...state, cursorIndex };
  }
  function chooseComparisonWinner(state, team) {
    if (state.mode !== "sort" || ![state.activeTeam, state.comparedTeam].includes(team) || state.comparedTeam == null) return state;
    const teams = [...state.teams];
    const activeIndex = teams.indexOf(state.activeTeam);
    const comparedIndex = teams.indexOf(state.comparedTeam);
    const winnerIndex = teams.indexOf(team);
    const loserIndex = team === state.activeTeam ? comparedIndex : activeIndex;
    if (winnerIndex > loserIndex) [teams[winnerIndex], teams[loserIndex]] = [teams[loserIndex], teams[winnerIndex]];
    return finish({ ...state, teams, cursorIndex: teams.indexOf(team) });
  }
  function moveCursor(state, direction) {
    return state.mode !== "select" ? state : { ...state, cursorIndex: Math.max(0, Math.min(state.teams.length - 1, state.cursorIndex + direction)) };
  }
  function begin(state) {
    if (state.mode !== "select") return state;
    const activeTeam = state.teams[state.cursorIndex];
    return { ...state, mode: "sort", activeTeam, comparedTeam: null, placementStart: { teams: [...state.teams], cursorIndex: state.cursorIndex } };
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
    return { ...state, teams, cursorIndex: target, comparedTeam };
  }
  function finish(state) {
    if (state.mode !== "sort") return state;
    return { ...state, mode: "select", activeTeam: null, comparedTeam: null, placementStart: null, compareAbove: false, compareBelow: false };
  }
  function cancel(state) {
    return state.mode !== "sort" ? state : { ...state, ...state.placementStart, mode: "select", activeTeam: null, comparedTeam: null, compareAbove: false, compareBelow: false, placementStart: null };
  }
  global.PairwisePicklist = { create, choose, chooseComparisonWinner, moveCursor, begin, setComparisonModifiers, move, finish, cancel };
}(globalThis));
