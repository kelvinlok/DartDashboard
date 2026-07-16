const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const stylesheet = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

function fillForSelectors(firstSelector, secondSelector) {
  const escape = (selector) => selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectors = `${escape(firstSelector)},\\s*${escape(secondSelector)}`;
  const rule = stylesheet.match(new RegExp(`${selectors}\\s*\\{[^}]*fill:\\s*([^;]+);`));
  return rule?.[1].trim();
}

test("uses black for even single beds and white for odd single beds", () => {
  assert.equal(fillForSelectors(".single.even", ".singleOuter.even"), "#171a1c");
  assert.equal(fillForSelectors(".single.odd", ".singleOuter.odd"), "#e8dec8");
});
