const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("provides an explicit miss button below the dartboard", () => {
  assert.match(
    html,
    /<div class="board-stack">[\s\S]*<div id="dartboard" class="dartboard"><\/div>[\s\S]*<button[^>]*id="miss-button"[^>]*>[\s\S]*Miss[\s\S]*0[\s\S]*<\/button>[\s\S]*<\/div>/,
  );
});
