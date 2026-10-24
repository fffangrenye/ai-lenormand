# 正式站源码与发布追溯

正式域名：https://floralenormand.site 。账号登录由 Supabase 提供；新站业务账本位于 Cloudflare SQLite Durable Object。用户数据、卡密库存、密钥及本机环境文件不属于源码，不提交 Git。

## 基线

固定标签 `flora-production-baseline-20261023` 指向本次完整源码提交。对应线上版本及文件指纹见 `releases/2026-10-23-production-baseline.json`。这是对已存在部署的事后核对，本次没有重新部署，也没有回填 Cloudflare 版本的原始注释。

## 后续发布

1. 修改完成后运行 `npm run security:source`，检查并提交所有预期源码；推送当前分支到 origin。
2. 运行 `npm run cf:release:check`。必须工作区干净、远端同名分支与本地 HEAD 完全一致、源码扫描通过。
3. 只有获得发布授权后，运行 `npm run cf:release:api`（flora-v3-api）或 `npm run cf:release:site`（flora-domain-info）。二者使用固定的正式配置，不使用旧 flora 默认配置。网页发布先安全构建并扫描产物。
4. 发布脚本将完整 Git commit 和分支写入 Cloudflare 版本 message，短 commit 写入 tag；回执保存在被 Git 忽略的 `.local-paid/releases/`，同时记录本次检查结果、耗时和发布前的 Worker 版本。无法取得旧版本时停止发布。
5. 验证正式站后，将不含密钥的发布回执整理到 `docs/releases/` 并提交、推送。记录两个 Worker 各自的版本；若只更新一个，明确另一个仍使用上次版本。
6. 发布失败或版本号未读到时，先查询 Cloudflare 实际状态，禁止盲目重试。两个 Worker 的发布不是跨服务原子事务。

`npm run cf:deploy` 现在仅执行发布前检查，不上传任何内容。直接调用 Wrangler 可以绕开本地发布脚本，因此本机制是发布流程保护，并非 Cloudflare 账户权限隔离。

回滚应选择已记录的 Cloudflare Worker 版本，并同时确认它需要的服务绑定、数据库兼容性及静态资源；不要盲目用旧默认配置覆盖生产站或旧域名跳转服务。

## 保管与重建

- GitHub 保存完整源码、锁文件、测试及部署配置。使用标签对应的代码和锁定依赖重建；线上编译产物的核对指纹不会承诺跨平台重新编译的字节完全相同。
- 私密配置通过 Cloudflare secrets 和独立密码管理系统保管；`.env.example` 仅列配置名称。不得将 `.local-paid`、`.env.local`、`.env.production`、充值码 TXT、数据库文件或下载的线上编译包提交仓库。
- Git 不是用户数据备份。业务数据库恢复策略需单独制定，本次不变更线上数据库或备份策略。
