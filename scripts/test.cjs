// Run the TypeScript node:test suites without emitting build artifacts.
const fs = require("node:fs");
const path = require("node:path");
require("./typescript-register.cjs");
const root = path.resolve(__dirname, "..");
function discover(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? discover(file) : file.endsWith(".test.ts") ? [file] : [];
  });
}
const files = process.argv.slice(2);
for (const file of files.length ? files.map((file) => path.resolve(root, file)) : discover(path.join(root, "lib"))) require(file);
