(function () {
  const $ = (selector) => document.querySelector(selector);
  const boardRoot = $("#selection-board");
  const rankingsRoot = $("#final-rankings");
  const picklistsRoot = $("#mobile-picklists");
  const emptyState = $("#empty-state");
  let activeTab = "board";

  function teamLabel(number, name = "") {
    return name ? `Team ${number} · ${name}` : `Team ${number}`;
  }

  function rankedTeamRow(team) {
    const row = document.createElement("li");
    row.className = `ranking-row state-${team.state}`;
    const compareColor = globalThis.mobileAllianceDisplay?.compareColorForSlot(team.comparisonSlot);
    if (compareColor) {
      row.className += " compare-selected";
      row.setAttribute("data-comparison-slot", String(team.comparisonSlot));
      row.setAttribute("style", `--compare-accent: ${compareColor}`);
    }
    const rank = document.createElement("span");
    rank.className = "rank-number";
    rank.textContent = String(team.rank);
    const label = document.createElement("span");
    label.textContent = `Team ${team.teamNumber}`;
    row.append(rank, label);
    if (Number.isFinite(team.score)) {
      const score = document.createElement("span");
      score.className = "team-score";
      score.textContent = String(team.score);
      row.append(score);
    }
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
      picklistsRoot.replaceChildren();
      return;
    }

    $("#event-name").textContent = `${snapshot.eventName || snapshot.eventKey} · ${snapshot.eventKey}`;
    boardRoot.replaceChildren();
    for (let alliance = 1; alliance <= 8; alliance += 1) {
      const group = document.createElement("section");
      group.className = "alliance-row";
      const heading = document.createElement("h3");
      heading.textContent = `Alliance ${alliance}`;
      group.append(heading);
      const slots = document.createElement("div");
      slots.className = "alliance-slots";
      snapshot.board.filter((slot) => slot.alliance === alliance).forEach((slot) => {
        const cell = document.createElement("div");
        cell.className = `board-slot${slot.teamNumber ? " occupied" : ""}`;
        cell.textContent = slot.teamNumber ? teamLabel(slot.teamNumber, slot.teamName) : "—";
        slots.append(cell);
      });
      group.append(slots);
      boardRoot.append(group);
    }

    rankingsRoot.replaceChildren();
    snapshot.rankings.forEach((team) => rankingsRoot.append(rankedTeamRow(team)));

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
      column.teams.forEach((team) => list.append(rankedTeamRow(team)));
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
