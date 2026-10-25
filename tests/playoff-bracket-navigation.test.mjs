import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync("src/app.js", "utf8");

assert.match(appSource, /const matchAttributes = match[\s\S]*?data-match=/);
assert.match(appSource, /document\.querySelectorAll\("\[data-match\]"\)/);
assert.match(appSource, /state\.activeView = "matchup";/);

const navItemsDeclaration = appSource.match(/const navItems = \[[\s\S]*?\n\];/)?.[0];
assert.ok(navItemsDeclaration, "app should declare its navigation item order");
const sourceFunction = (name) => {
  const definition = appSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))?.[0];
  assert.ok(definition, `app should define ${name}`);
  return definition;
};
const navigationContext = { globalThis: { firebaseUserRole: "member" } };
vm.runInNewContext([
  navItemsDeclaration,
  sourceFunction("isAdmin"),
  sourceFunction("canView"),
  sourceFunction("visibleNavItems"),
  "globalThis.memberViews = visibleNavItems().map(({ view }) => view);",
].join("\n"), navigationContext);
const memberViews = Array.from(navigationContext.globalThis.memberViews);
assert.ok(memberViews.includes("bracket"), "the Playoff Bracket remains available to regular users");
assert.ok(!memberViews.some((view) => view.startsWith("admin")), "admin navigation remains restricted to admins");
assert.equal(memberViews.indexOf("bracket"), memberViews.indexOf("alliance") + 1, "Playoff Bracket appears directly below Alliance Selection");
navigationContext.globalThis.firebaseUserRole = "admin";
vm.runInNewContext("globalThis.adminViews = visibleNavItems().map(({ view }) => view);", navigationContext);
const adminViews = Array.from(navigationContext.globalThis.adminViews);
assert.ok(adminViews.includes("adminEventControl"), "admins retain access to admin pages");
assert.equal(adminViews.indexOf("bracket"), adminViews.indexOf("alliance") + 1, "admin navigation retains the same bracket placement");

console.log("PASS playoff bracket matches navigate to Matchup");
