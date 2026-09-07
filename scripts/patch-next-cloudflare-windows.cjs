const fs = require("fs");
const path = require("path");

const root = process.cwd();
const nextRoot = fs
  .readdirSync(path.join(root, "node_modules", ".pnpm"), { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.startsWith("next@14.2.35_"));

if (!nextRoot) {
  console.warn("Next 14.2.35 package was not found; skipping Cloudflare Windows patch.");
  process.exit(0);
}

const nextPackageRoot = path.join(root, "node_modules", ".pnpm", nextRoot.name, "node_modules", "next");

function patchFile(relativePath, marker, patcher) {
  const filePath = path.join(nextPackageRoot, relativePath);
  let source = fs.readFileSync(filePath, "utf8");
  if (source.includes(marker)) return;

  const patched = patcher(source);
  if (patched === source) {
    throw new Error(`Unable to patch ${relativePath}`);
  }

  fs.writeFileSync(filePath, patched);
  console.log(`Patched ${relativePath}`);
}

patchFile(
  path.join("dist", "build", "utils.js"),
  'if (e.code === "EPERM")',
  (source) =>
    source.replace(
      'if (e.code !== "EEXIST") {\n                            throw e;\n                        }',
      'if (e.code === "EPERM") {\n                            await _fs.promises.cp(_path.default.resolve(_path.default.dirname(tracedFilePath), symlink), fileOutputPath, {\n                                recursive: true\n                            });\n                        } else if (e.code !== "EEXIST") {\n                            throw e;\n                        }'
    )
);

patchFile(
  path.join("dist", "server", "next-server.js"),
  'String(error == null ? void 0 : error.message).includes("Dynamic require")',
  (source) =>
    source.replace(
      "const manifest = require(this.middlewareManifestPath);\n        return manifest;",
      'let manifest;\n        try {\n            manifest = require(this.middlewareManifestPath);\n        } catch (error) {\n            if (String(error == null ? void 0 : error.message).includes("Dynamic require")) {\n                return null;\n            }\n            throw error;\n        }\n        if (!Object.keys(manifest.middleware || {}).length && !Object.keys(manifest.functions || {}).length) {\n            return null;\n        }\n        return manifest;'
    )
);
