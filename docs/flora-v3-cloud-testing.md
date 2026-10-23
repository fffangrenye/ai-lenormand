# Flora V3 公开测试与后续迁移

## 当前发布边界

- 新域名 `floralenormand.site` 与 `www.floralenormand.site` 使用独立 Worker `flora-domain-info`；其花瓣、签到、牌阵及历史保存在 `flora-v3-api` 的 SQLite Durable Object。
- 用户于 2026-10-22 明确选择“旧历史暂时不用，所有旧页面直接跳新站”，并确认旧入口为 `flora`、`ai-lenormand`、`ai-lenormand-cloudflare-preview`。使用三个专用 redirect 配置切换，不更改旧 Supabase 历史表。新站复用原 Supabase 身份认证；已有用户使用原邮箱密码重新登录，登录状态不跨域复制。
- 首次体验一次性赠送 1 花瓣；每连续签到满 3 天再送 1 花瓣。重复登录、刷新、并发请求不会重复发放。
- 新站独立保存新版历史；原站历史不导入、不删除。旧项目直达链接转到新站 `/deep`，避免将旧项目 ID 当成新账本 ID。
- 用户于 2026-10-22 确认三档商品和卡密已配置，正式站设置 `SALES_ENABLED=1` 开放 1／5／10 花瓣购买；设置为 `0` 可关闭所有购买按钮，不影响已有正式码兑换。正式充值码以 `FLORA-` 开头，与本地 `FLLOCAL-` 码完全隔离。
- 本地模拟支付、测试补发、测试登录及本地管理口令接口在公网返回 404。

## 维护与发布

1. `npm run test:paid-local`；后端打包 `npx wrangler deploy --config wrangler.flora-v3-api.jsonc --dry-run --outdir .local-paid/cloud-api-build` 后运行 `node scripts/test-cloud-ledger.cjs`。
2. 后端仅使用 `wrangler.flora-v3-api.jsonc` 发布。运行时密钥由 Cloudflare Secret 保管；兑换码签名密钥必须保持不变，不可随意重置。私有的本地恢复文件在 `.local-paid` 内，不上传 GitHub。
3. 前端 `npm run cf:build:secure -- --flora-v3`，必要时 `node scripts/prune-cloud-private.cjs`，然后 `npm run cf:scan-artifacts`。必须确认私有文件、服务端密钥扫描为零。
4. 前端仅用 `npx wrangler deploy --config wrangler.flora-v3-site.jsonc`。**不要使用默认 cf:deploy 或默认 wrangler.jsonc，它们指向旧站 flora，会覆盖现有跳转。** 旧入口分别用 `wrangler.redirect-flora.jsonc`、`wrangler.redirect-ai-lenormand.jsonc`、`wrangler.redirect-preview.jsonc`。
5. 新域名测试首页、登录、日历、抽牌、解读、两次追问、跨设备记录、兑换防重、充值码后台。真实闲鱼付款/自动发货需等正式库存导入后另行测试。

## 测试通过后的迁移顺序

1. 核对旧 Supabase 用户 UUID、邮箱、项目、牌面、解读及追问的关联；先做只读数量与余额报告。
2. 导出需迁移的数据并保留恢复点，确定花瓣与既有赠送的合并规则，避免重复赠送；不把旧版每日免费次数当作已购花瓣。
3. 以旧记录 ID 做幂等导入，保留原时间和权限。核对逐账号数量、牌面、历史可读性与花瓣流水；重复运行不能重复入账。
4. 最终迁移时需要短暂控制旧站写入，补齐最后新增记录。不能在旧站持续写入时仅做一次静态复制后直接跳转。
5. 迁移验收后再更新旧 Worker 为保留路径、查询参数的正式站跳转，并处理旧项目链接映射。先测试临时跳转，确认稳定后使用永久跳转。
6. 旧数据保留恢复窗口；用户在新域名重新登录。不要要求用户搬运访问令牌。
