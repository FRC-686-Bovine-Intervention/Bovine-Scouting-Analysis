(function () {
  const $ = (selector) => document.querySelector(selector);
  const boardRoot = $("#selection-board");
  const rankingsRoot = $("#final-rankings");
  const picklistsRoot = $("#mobile-picklists");
  const emptyState = $("#empty-state");
  let activeTab = "board";

  function metricFill(score, minScore, maxScore) {
    if (maxScore <= minScore) return "transparent";
    const ratio = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)));
    return `hsl(${Math.round(ratio * 120)} 58% 38%)`;
  }

  function rankedTeamRow(team, scoreRange = null, includeRank = true) {
    const row = document.createElement("li");
    row.className = `ranking-row state-${team.state}`;
    const compareColor = globalThis.mobileAllianceDisplay?.compareColorForSlot(team.comparisonSlot);
    const rowStyles = [];
    if (compareColor) {
      row.className += " compare-selected";
      row.setAttribute("data-comparison-slot", String(team.comparisonSlot));
      rowStyles.push(`--compare-accent: ${compareColor}`);
    }
    if (Number.isFinite(team.score)) {
      rowStyles.push(`--metric-fill: ${metricFill(Number(team.score), scoreRange?.min ?? Number.NaN, scoreRange?.max ?? Number.NaN)}`);
    }
    if (rowStyles.length) row.setAttribute("style", rowStyles.join("; "));
    const cells = [];
    if (includeRank) {
      const rank = document.createElement("span");
      rank.className = "rank-number";
      rank.textContent = String(team.rank);
      cells.push(rank);
    }
    const label = document.createElement("span");
    label.textContent = team.teamNumber;
    cells.push(label);
    if (Number.isFinite(team.score)) {
      const score = document.createElement("span");
      score.className = "team-score";
      score.textContent = Number(team.score).toFixed(1);
      cells.push(score);
    }
    row.append(...cells);
    return row;
  }

  function render(snapshot) {
    const valid = globalThis.mobileAllianceDisplay?.validateMobileAllianceSnapshot(snapshot);
    emptyState.hidden = Boolean(valid);
    $("#board-view").hidden = !valid || activeTab !== "board";
    $("#picklists-view").hidden = !valid || activeTab !== "picklists";
    if (!valid) {
      $("#event-name").textContent = "Waiting for the admin display…";
      boardRoot.replaceChildren();
      rankingsRoot.replaceChildren();
      picklistsRoot.className = "mobile-picklists is-empty";
      picklistsRoot.dataset.columnCount = "0";
      picklistsRoot.replaceChildren();
      $("#mobile-picklists-hint").hidden = true;
      return;
    }

    $("#event-name").textContent = `${snapshot.eventName || snapshot.eventKey} · ${snapshot.eventKey}`;
    boardRoot.replaceChildren();
    for (let alliance = 1; alliance <= 8; alliance += 1) {
      const group = document.createElement("section");
      group.className = "alliance-row";
      const heading = document.createElement("h3");
      heading.textContent = `A${alliance}`;
      group.append(heading);
      const slots = document.createElement("div");
      slots.className = "alliance-slots";
      const allianceSize = snapshot.board.length / 8;
      group.setAttribute("style", `--alliance-slot-count: ${allianceSize}`);
      snapshot.board.filter((slot) => slot.alliance === alliance).forEach((slot) => {
        const cell = document.createElement("div");
        cell.className = `board-slot${slot.teamNumber ? " occupied state-picked" : ""}`;
        cell.textContent = slot.teamNumber || "—";
        const compareColor = globalThis.mobileAllianceDisplay?.compareColorForSlot(slot.comparisonSlot);
        if (compareColor) {
          cell.className += " compare-selected";
          cell.setAttribute("style", `--compare-accent: ${compareColor}`);
        }
        slots.append(cell);
      });
      group.append(slots);
      const allianceEpa = document.createElement("div");
      allianceEpa.className = "alliance-epa";
      const epaTotal = snapshot.allianceEpa?.[alliance - 1];
      allianceEpa.textContent = Number.isFinite(epaTotal) ? `EPA=${Number(epaTotal).toFixed(1)}` : "---";
      group.append(allianceEpa);
      boardRoot.append(group);
    }

    rankingsRoot.replaceChildren();
    snapshot.rankings.forEach((team) => rankingsRoot.append(rankedTeamRow(team)));

    picklistsRoot.className = `mobile-picklists${snapshot.columns.length ? "" : " is-empty"}`;
    picklistsRoot.dataset.columnCount = String(snapshot.columns.length);
    const narrowScreen = globalThis.matchMedia?.("(max-width: 699px)").matches === true;
    $("#mobile-picklists-hint").hidden = snapshot.columns.length < 2 || narrowScreen;
    picklistsRoot.replaceChildren();
    if (!snapshot.columns.length) {
      const message = document.createElement("p");
      message.className = "empty-state";
      message.textContent = "No picklists or ranking sources are currently displayed.";
      picklistsRoot.append(message);
    }
    snapshot.columns.forEach((column) => {
      const card = document.createElement("article");
      card.className = "mobile-card";
      const heading = document.createElement("h2");
      heading.textContent = column.label;
      const list = document.createElement("ol");
      list.className = "mobile-rankings";
      const scores = column.teams.map((team) => team.score).filter(Number.isFinite);
      const scoreRange = scores.length ? { min: Math.min(...scores), max: Math.max(...scores) } : null;
      column.teams.forEach((team) => list.append(rankedTeamRow(team, scoreRange, false)));
      card.append(heading, list);
      picklistsRoot.append(card);
    });
  }

  function connect() {
    const api = globalThis.firebaseMobileDisplayApi;
    if (!api || globalThis.__mobileAllianceSubscriptionStarted) return;
    globalThis.__mobileAllianceSubscriptionStarted = true;
    api.subscribeMobileAllianceSnapshot((snapshot) => {
      $("#connection-state").textContent = "Live";
      render(snapshot);
    }, (error) => {
      console.warn("Unable to subscribe to the public alliance selection display.", error);
      $("#connection-state").textContent = "Connection error";
    });
  }

  document.querySelectorAll("[data-mobile-tab]").forEach((button) => button.addEventListener("click", () => {
    activeTab = button.dataset.mobileTab;
    document.querySelectorAll("[data-mobile-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
    $("#board-view").hidden = activeTab !== "board" || emptyState.hidden === false;
    $("#picklists-view").hidden = activeTab !== "picklists" || emptyState.hidden === false;
  }));
  globalThis.addEventListener("firebase-mobile-display-api-ready", connect);
  connect();
})();
