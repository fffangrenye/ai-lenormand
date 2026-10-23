// A local source snapshot and a separate consistent SQLite backup. Never pushes or deploys.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { DatabaseSync, backup } = require("node:sqlite");

async function main() {
  const root = path.resolve(__dirname, "..");
  const versionFlag = process.argv.indexOf("--version");
  const version = versionFlag >= 0 ? process.argv[versionFlag + 1] : "v1";
  if (!/^v\d+(?:\.\d+){0,2}$/.test(version || "")) throw new Error("版本号格式应为 v1.1、v2 或 v3。");
  const time = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace(/\D/g, "");
  const destination = path.join(root, ".local-paid", "backups", `ui-${version}-${time}-${crypto.randomBytes(2).toString("hex")}`);
  fs.mkdirSync(destination, { recursive: true });
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  const excluded = (file) => file.split("/").some((part) => /^(\.git|\.local-paid|\.next.*|node_modules|\.wrangler|\.vercel|\.open-next|\.codex.*|\.aws)$/i.test(part) || /^\.env/i.test(part)) || /\.(sqlite(?:-wal|-shm)?|db|pem|key|p12|pfx)$/i.test(file);
  const files = [...new Set(git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean))]
    .filter((file) => !excluded(file) && fs.existsSync(path.join(root, file)) && fs.lstatSync(path.join(root, file)).isFile()).sort();
  const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const manifest = { version: version.toUpperCase(), createdAt: new Date().toISOString(), timeZone: "Asia/Shanghai", branch: git(["branch", "--show-current"]).trim(), baseCommit: git(["rev-parse", "HEAD"]).trim(), note: "Working files, including uncommitted and new source files; not a Git commit. No credentials or local test database included.", files: files.map((file) => ({ path: file, sha256: sha(path.join(root, file)) })) };
  fs.writeFileSync(path.join(destination, "SOURCE-MANIFEST.json"), JSON.stringify(manifest, null, 2));
  const snapshot = path.join(destination, "source-snapshot");
  fs.mkdirSync(snapshot);
  for (const file of files) { const target = path.join(snapshot, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, file), target); }
  fs.copyFileSync(path.join(destination, "SOURCE-MANIFEST.json"), path.join(snapshot, "SOURCE-MANIFEST.json"));
  const archive = path.join(destination, `flora-${version}-source.zip`);
  const verifyRoot = path.join(destination, "verified-source");
  if (process.platform !== "win32") throw new Error("此本机备份命令需要 Windows PowerShell。");
  // Native .NET ZIP supports the Chinese workspace path and includes dotfiles.
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:FLORA_BACKUP_SOURCE, $env:FLORA_BACKUP_ZIP, [IO.Compression.CompressionLevel]::Optimal, $false); [IO.Compression.ZipFile]::ExtractToDirectory($env:FLORA_BACKUP_ZIP, $env:FLORA_BACKUP_VERIFY)"], {
    cwd: root, windowsHide: true, env: { ...process.env, FLORA_BACKUP_SOURCE: snapshot, FLORA_BACKUP_ZIP: archive, FLORA_BACKUP_VERIFY: verifyRoot }
  });
  for (const file of manifest.files) if (sha(path.join(verifyRoot, file.path)) !== file.sha256) throw new Error(`Backup verification failed: ${file.path}`);
  if (fs.readdirSync(verifyRoot).some((file) => /^\.env/i.test(file))) throw new Error("Unexpected environment file in backup");
  const relative = path.relative(destination, path.resolve(verifyRoot));
  if (relative !== "verified-source") throw new Error("Unexpected temporary directory");
  fs.rmSync(verifyRoot, { recursive: true }); // Only the just-created, verified extraction folder.
  if (path.relative(destination, path.resolve(snapshot)) !== "source-snapshot") throw new Error("Unexpected source snapshot directory");
  fs.rmSync(snapshot, { recursive: true }); // Only the just-created staging copy, after verification.
  const sourceDb = path.join(root, ".local-paid", "v1.sqlite");
  if (fs.existsSync(sourceDb)) {
    const source = new DatabaseSync(sourceDb, { readOnly: true });
    try { await backup(source, path.join(destination, "private-local-test-data.sqlite")); } finally { source.close(); }
    const check = new DatabaseSync(path.join(destination, "private-local-test-data.sqlite"), { readOnly: true });
    try {
      if (check.prepare("PRAGMA integrity_check").get().integrity_check !== "ok" || check.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Database backup verification failed");
    } finally { check.close(); }
  }
  fs.writeFileSync(path.join(destination, "恢复说明.md"), `# 雷诺曼 ${version.toUpperCase()} 备份\n\n代码包：${path.basename(archive)}（${files.length} 个源文件，已解压并逐文件核对 SHA-256）。包含当前未提交的新代码、图片、锁文件、文档和测试。\n\n恢复：解压到新的空文件夹，安装锁文件指定依赖，使用 Node.js 24，运行 npm run dev:paid-local。不要覆盖正在使用的网站目录。无需生产密钥即可运行本地模拟。\n\nprivate-local-test-data.sqlite 是单独的本地测试记录快照，不在代码压缩包里。仅需要恢复测试记录时，在关闭本地开发服务后放到新目录 .local-paid/v1.sqlite；不要上传到 GitHub。\n\n.env、生产密钥、依赖安装目录和编译缓存均未归档。原机器上的环境配置仍原样保留。\n\n当前分支：${manifest.branch}\n基准提交：${manifest.baseCommit}\n代码包 SHA-256：${sha(archive)}\n\n本操作未创建 Git 提交、推送、合并或部署。下一步与规则确认见代码包内 docs/ui-v1-next-steps.md。\n`, "utf8");
  process.stdout.write(JSON.stringify({ directory: destination, archive, sourceFiles: files.length, sourceMiB: +(fs.statSync(archive).size / 1048576).toFixed(2), verified: true, databaseBackup: fs.existsSync(sourceDb) }, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
