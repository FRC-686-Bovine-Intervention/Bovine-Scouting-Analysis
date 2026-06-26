const storageKeys = {
  user: "frc-scouting-user",
  users: "frc-scouting-users",
  theme: "frc-scouting-theme",
  activeView: "frc-scouting-view",
  metric: "frc-scouting-metric",
  selectedTeam: "frc-scouting-selected-team",
  selectedMatch: "frc-scouting-selected-match",
  menuExpanded: "frc-scouting-menu-expanded",
  loadedPicklists: "frc-scouting-loaded-picklists",
  allianceBoard: "frc-scouting-alliance-board",
};

const seedUsers = ["Avery", "Jordan", "Morgan"];

const event = {
  key: "2026miket",
  name: "Lake Superior Regional",
  season: 2026,
  matchesComplete: 42,
};

const metrics = [
  { id: "weighted", label: "Weighted Pick Score", unit: "pts", components: { scouterTotal: 0.45, epa: 0.25, pridge: 0.2, consistency: 0.1 } },
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
  { view: "picklists", label: "Picklists", icon: "picklists" },
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
].map(enrichTeam);

const matches = [
  { number: 38, red: [1678, 4414, 6800], blue: [254, 3005, 7426] },
  { number: 39, red: [118, 2910, 6328], blue: [1323, 971, 2056] },
  { number: 40, red: [254, 971, 6800], blue: [1678, 118, 3005] },
  { number: 41, red: [2056, 1323, 7426], blue: [2910, 4414, 6328] },
];

const picklists = [
  { name: "First Pick", metric: "weighted", teams: [1678, 254, 1323, 2910, 971, 118, 2056, 4414, 6328, 3005, 6800, 7426] },
  { name: "Defense / Backup", metric: "defenseImpact", teams: [6800, 118, 3005, 971, 1323, 2056, 2910, 6328, 4414, 1678, 254, 7426] },
];

const defaultAllianceBoard = [1678, 254, 1323, 2910, 971, 118, 2056, 4414, ...Array(16).fill(null)];

const state = {
  user: localStorage.getItem(storageKeys.user) || "",
  users: readJson(storageKeys.users, seedUsers),
  theme: localStorage.getItem(storageKeys.theme) || "light",
  activeView: normalizeView(localStorage.getItem(storageKeys.activeView)),
  metric: localStorage.getItem(storageKeys.metric) || "weighted",
  selectedTeam: Number(localStorage.getItem(storageKeys.selectedTeam)) || teams[0].number,
  selectedMatch: Number(localStorage.getItem(storageKeys.selectedMatch)) || matches[0].number,
  menuExpanded: localStorage.getItem(storageKeys.menuExpanded) === "true",
  loadedPicklists: readJson(storageKeys.loadedPicklists, [picklists[0].name]),
  allianceBoard: normalizeBoard(readJson(storageKeys.allianceBoard, defaultAllianceBoard)),
  contextMenu: null,
};

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

function saveState() {
  localStorage.setItem(storageKeys.users, JSON.stringify(state.users));
  localStorage.setItem(storageKeys.user, state.user);
  localStorage.setItem(storageKeys.theme, state.theme);
  localStorage.setItem(storageKeys.activeView, state.activeView);
  localStorage.setItem(storageKeys.metric, state.metric);
  localStorage.setItem(storageKeys.selectedTeam, String(state.selectedTeam));
  localStorage.setItem(storageKeys.selectedMatch, String(state.selectedMatch));
  localStorage.setItem(storageKeys.menuExpanded, String(state.menuExpanded));
  localStorage.setItem(storageKeys.loadedPicklists, JSON.stringify(state.loadedPicklists));
  localStorage.setItem(storageKeys.allianceBoard, JSON.stringify(state.allianceBoard));
}

function normalizeView(view) {
  return appViews.some((item) => item.view === view) ? view : "teams";
}

function normalizeBoard(board) {
  const next = Array.isArray(board) ? board.slice(0, 24) : [];
  while (next.length < 24) next.push(null);
  return next.map((value) => (Number.isFinite(Number(value)) && value !== "" ? Number(value) : null));
}

function pickedTeams() {
  return state.allianceBoard.filter((team) => team !== null);
}

function enrichTeam(team) {
  const scouterTotal = average(team.matches);
  const weighted =
    scouterTotal * 0.45 +
    team.epa * 0.25 +
    team.pridge * 0.2 +
    team.consistency * 0.1;
  return {
    ...team,
    scouterTotal,
    weighted,
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
  return metrics.find((metric) => metric.id === id) || metrics[0];
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

function setView(view) {
  state.activeView = view;
  saveState();
  render();
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
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
          ${navItems.map((item) => navButton(item)).join("")}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="page-title">
            <p class="eyebrow">${event.key}</p>
            <h1>${viewTitle(state.activeView)}</h1>
          </div>
          <div class="split-row">
            <select aria-label="Theme" id="themeSelect">
              <option value="light" ${state.theme === "light" ? "selected" : ""}>Light</option>
              <option value="dark" ${state.theme === "dark" ? "selected" : ""}>Dark</option>
            </select>
            <button id="logoutButton">Sign out ${state.user}</button>
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
          <select aria-label="Theme" id="themeSelect">
            <option value="light" ${state.theme === "light" ? "selected" : ""}>Light</option>
            <option value="dark" ${state.theme === "dark" ? "selected" : ""}>Dark</option>
          </select>
        </div>
        <div class="login-actions">
          <label>
            Existing user
            <select id="existingUser">
              <option value="">Select user</option>
              ${state.users.map((user) => `<option value="${user}">${user}</option>`).join("")}
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

  document.querySelector("#themeSelect").addEventListener("change", (event) => setTheme(event.target.value));
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

function icon(name) {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    teams: '<path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2 21a6 6 0 0 1 12 0"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M22 21a5 5 0 0 0-6-5"/>',
    rankings: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    analysis: '<path d="M4 19h16"/><path d="M6 15h10"/><path d="M8 11h12"/><path d="M5 7h7"/><path d="M14 7h4"/>',
    schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    matchup: '<path d="M7 7h10"/><path d="M7 17h10"/><path d="M9 7a3 3 0 1 1 0 6"/><path d="M15 17a3 3 0 1 1 0-6"/>',
    quality: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    picklists: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
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
    picklists: "Picklists",
    alliance: "Alliance Selection",
    admin: "Admin",
  }[view];
}

function bindShellEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelector("#themeSelect").addEventListener("change", (event) => setTheme(event.target.value));
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
    picklists: renderPicklists,
    alliance: renderAlliance,
    admin: renderAdmin,
  }[state.activeView]();
}

function renderRankings() {
  const ranked = [...teams]
    .sort((a, b) => b.weighted - a.weighted)
    .map((team, index) => ({ ...team, rank: index + 1, rp: rankingPoints(team), record: recordForTeam(team) }));
  return `
    <article class="card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">TBA-style view</p>
          <h2>Current Event Rankings</h2>
        </div>
        <span class="muted">Sorted by ranking score, then weighted score</span>
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
            <span>${team.weighted.toFixed(2)}</span>
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
  return Math.max(8, Math.round(team.weighted / 4));
}

function recordForTeam(team) {
  const wins = Math.max(1, Math.min(8, Math.round(team.weighted / 9)));
  const losses = Math.max(0, 8 - wins);
  return `${wins}-${losses}-0`;
}

function renderTeams() {
  return `
    <div class="team-title-row">
      <div>
        <p class="eyebrow">Numerical order</p>
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
            <span class="muted">${team.weighted.toFixed(1)} weighted / ${team.consistency}% consistency</span>
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
  return `
    <article class="card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Team ${team.number}</p>
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
          <h3>Match Trend</h3>
          ${renderSparkline(team.matches)}
        </div>
        <div class="compact-flags">
          <h3>Flags</h3>
          ${team.flags.length ? team.flags.map((flag) => `<p><span class="flag ${flag.severity}">${flag.label}</span> <span class="flag-evidence">${flag.evidence}</span></p>`).join("") : `<p class="muted">No active flags.</p>`}
        </div>
      </div>
    </article>
  `;
}

function renderSparkline(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = 14 + (index / (values.length - 1)) * 80;
      const y = 82 - ((value - min) / range) * 64;
      return `${x},${y}`;
    })
    .join(" ");
  return `
    <svg class="trend-chart" viewBox="0 0 100 100" role="img" aria-label="Match trend" width="100%" height="260">
      <line x1="14" y1="82" x2="94" y2="82" stroke="var(--line)" stroke-width="1"></line>
      <line x1="14" y1="18" x2="14" y2="82" stroke="var(--line)" stroke-width="1"></line>
      <text x="54" y="97" text-anchor="middle">Match Number</text>
      <text x="4" y="50" text-anchor="middle" transform="rotate(-90 4 50)">Metric Value</text>
      <text x="12" y="20" text-anchor="end">${Math.round(max)}</text>
      <text x="12" y="84" text-anchor="end">${Math.round(min)}</text>
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke"></polyline>
      ${values
        .map((value, index) => {
          const x = 14 + (index / (values.length - 1)) * 80;
          const y = 82 - ((value - min) / range) * 64;
          return `<circle cx="${x}" cy="${y}" r="2.6" fill="var(--accent-strong)"><title>Match ${index + 1}: ${value}</title></circle>`;
        })
        .join("")}
    </svg>
  `;
}

function renderAnalysis() {
  const metric = metricById(state.metric);
  const ranked = [...teams].sort((a, b) => b[state.metric] - a[state.metric]);
  const distributions = ranked.map((team) => distributionForMetric(team, state.metric));
  const globalMin = Math.min(...distributions.map((item) => item.min));
  const globalMax = Math.max(...distributions.map((item) => item.max));
  const eventAverage = average(ranked.map((team) => team[state.metric]));
  return `
    <div class="toolbar">
      <label>
        Metric
        <select id="metricSelect">
          ${metrics.map((item) => `<option value="${item.id}" ${item.id === state.metric ? "selected" : ""}>${item.label}</option>`).join("")}
        </select>
      </label>
      <div class="stat"><span>Event Average</span><strong>${eventAverage.toFixed(1)} ${metric.unit}</strong></div>
    </div>
    <div class="analysis-chart" style="margin-top: 14px;">
      ${ranked.map((team) => renderChartRow(team, metric, distributionForMetric(team, state.metric), globalMin, globalMax, eventAverage)).join("")}
    </div>
  `;
}

function distributionForMetric(team, metricId) {
  if (metricId === "scouterTotal" || metricId === "weighted") {
    const values = metricId === "weighted" ? team.matches.map((value) => value * 0.45 + team.epa * 0.25 + team.pridge * 0.2 + team.consistency * 0.1) : team.matches;
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

function renderChartRow(team, metric, dist, globalMin, globalMax, eventAverage) {
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
  return `
    <div class="chart-row">
      <div class="chart-team">
        <span class="chart-badges">${renderTeamBadges(team)}</span>
        <button class="nav-button chart-name" data-team-link="${team.number}">${team.number}</button>
      </div>
      <div class="plot" title="${team.name}: ${team[state.metric].toFixed(1)} ${metric.unit}">
        <span class="event-average" style="left: ${avg}%"></span>
        <span class="whisker" style="left: ${whiskerLeft}%; width: ${whiskerWidth}%"></span>
        <span class="quartile" style="left: ${qLeft}%; width: ${qWidth}%"></span>
        <span class="median" style="left: ${median}%"></span>
        <span class="mean" style="left: ${mean}%"></span>
      </div>
      <div class="chart-value">${team[state.metric].toFixed(1)}</div>
    </div>
  `;
}

function renderSchedule() {
  return `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Event matches</p>
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
        <p class="eyebrow">Qualification ${match.number}</p>
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
                  <span class="muted">${team.weighted.toFixed(1)} weighted / ${team.consistency}% consistency</span>
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
        <article class="data-row">
          <div class="split-row">
            <strong>${team.number} ${team.name}</strong>
            ${renderTeamBadges(team)}
          </div>
          ${team.flags.map((flag) => `<span class="flag-evidence">${flag.evidence}</span>`).join("")}
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderPicklists() {
  return `
    <div class="picklist-columns">
      ${picklists
        .map(
          (picklist) => `
        <article class="card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">${metricById(picklist.metric).label}</p>
              <h2>${picklist.name}</h2>
            </div>
            <button>Criteria</button>
          </div>
          ${picklist.teams.map((number, index) => renderPicklistTile(number, index)).join("")}
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderPicklistTile(number, index) {
  const team = teamByNumber(number);
  const picked = pickedTeams().includes(number) ? "picked" : "";
  return `
    <button class="picklist-tile ${picked}" data-team="${team.number}" data-drag-team="${team.number}" draggable="${picked ? "false" : "true"}">
      <strong>${index + 1}</strong>
      <span>${team.number} ${team.name}</span>
      <span>${team.weighted.toFixed(1)}</span>
    </button>
  `;
}

function renderAlliance() {
  const loaded = picklists.filter((picklist) => state.loadedPicklists.includes(picklist.name));
  return `
    <div class="grid alliance-layout">
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Live board</p>
            <h2>Selection Board</h2>
          </div>
        </div>
        <div class="board">
          ${state.allianceBoard.map((teamNumber, index) => renderBoardCell(teamNumber, index)).join("")}
        </div>
        ${renderBoardContextMenu()}
        <div class="section-heading">
          <div>
            <p class="eyebrow">Saved lists</p>
            <h2>Picklist Selector</h2>
          </div>
        </div>
        <div class="picklist-loader">
          ${picklists
            .map(
              (picklist) => `
            <label class="check-row">
              <input type="checkbox" class="picklist-check" value="${picklist.name}" ${state.loadedPicklists.includes(picklist.name) ? "checked" : ""} />
              <span>${picklist.name}</span>
              <span class="muted">${metricById(picklist.metric).label}</span>
            </label>
          `,
            )
            .join("")}
        </div>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Loaded lists</p>
            <h2>Displayed Picklists</h2>
          </div>
        </div>
        <div class="picklist-columns alliance-picklists">
          ${
            loaded.length
              ? loaded
                  .map(
                    (picklist) => `
              <section>
                <h3>${picklist.name}</h3>
                ${picklist.teams.map((number, index) => renderPicklistTile(number, index)).join("")}
              </section>
            `,
                  )
                  .join("")
              : `<div class="empty-state">Select one or more saved picklists to load them here.</div>`
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
  if (!state.contextMenu) return "";
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
    <div class="grid cols-2">
      <article class="card">
        <h2>Imports</h2>
        <p class="muted">Scouter spreadsheet import contract is ready for CSV/XLSX parsing.</p>
        <button>Import scouting data</button>
      </article>
      <article class="card">
        <h2>External Sync</h2>
        <p class="muted">Statbotics, TBA, and pRidge are modeled as refreshable metric sources.</p>
        <button>Refresh metrics</button>
      </article>
    </div>
  `;
}

function renderFlags(flags) {
  if (!flags.length) return "";
  return `<span class="flag-list">${flags.map((flag) => `<span class="flag ${flag.severity}">${flag.label}</span>`).join("")}</span>`;
}

function renderTeamBadges(team) {
  const drivetrainFlags = team.drivetrain === "swerve" ? [] : [{ label: "Non-Swerve", severity: "warn" }];
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

function bindViewEvents() {
  document.querySelector("#metricSelect")?.addEventListener("change", (event) => {
    state.metric = event.target.value;
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
      state.contextMenu = { cell: cellIndex, x: event.clientX, y: event.clientY };
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
  document.addEventListener("click", () => {
    if (!state.contextMenu) return;
    state.contextMenu = null;
    render();
  }, { once: true });
  document.querySelectorAll(".picklist-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.loadedPicklists = Array.from(document.querySelectorAll(".picklist-check:checked")).map((input) => input.value);
      saveState();
      render();
    });
  });
}
