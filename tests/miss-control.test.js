const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("provides an explicit miss button below the dartboard", () => {
  assert.match(
    html,
    /<div class="board-stack">[\s\S]*<div id="dartboard" class="dartboard"><\/div>[\s\S]*<button[^>]*id="miss-button"[^>]*>[\s\S]*Miss[\s\S]*0[\s\S]*<\/button>[\s\S]*<\/div>/,
  );

  const [openingTag] = html.match(/<button[^>]*id="miss-button"[^>]*>/) || [];
  assert.ok(openingTag, "expected a native Miss button");
  assert.match(openingTag, /\btype="button"/);
  assert.match(openingTag, /\baria-label="Record missed dart for zero points"/);
});

test("allows the board stack to shrink within the board stage", () => {
  assert.match(css, /\.board-stack\s*{[^}]*\bmin-width:\s*0;/);
  assert.match(
    css,
    /@media \(max-width: 1020px\)[\s\S]*?\.dartboard\s*{[^}]*\bwidth:\s*min\(100%,\s*620px\);/,
  );
});
