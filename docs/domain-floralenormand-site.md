# floralenormand.site 接入记录

日期：2026-10-21。用户授权将腾讯云购买的新域名接入 Cloudflare；保留现有线上网站，完整付费版继续本地开发。客服邮箱经用户确认公开为 1041871342@qq.com，个人运营，价格及币种尚未最终确定。

## 域名与保护状态

- 域名注册商仍为腾讯云 / DNSPod，不转移注册商，不改变续费设置。
- Cloudflare 账号：ba9ee3a5752bb83f8bb97f3b60dfa88b。
- 新域名 Zone：e2db0b329df91901b4b4a1b58c315596，状态 active，Free Website。
- 权威 DNS：liberty.ns.cloudflare.com、terry.ns.cloudflare.com。
- 原 DNS：drone.dnspod.net、same.dnspod.net。接入前无网站、MX、TXT、www 解析记录。
- 腾讯云“禁止更新锁”经用户明确同意临时关闭，仅用于修改新域名 NS；修改后已立即重新开启并核验。“禁止转移锁”始终保持开启。未调整 DNSSEC。

## 独立介绍站

部署配置为 `wrangler.domain-info.jsonc`，Worker 名称 **flora-domain-info**。严禁为更新介绍站而使用主站 `wrangler.jsonc` 或 `cf:deploy`。

- 公网：https://floralenormand.site/ 与 https://www.floralenormand.site/。
- Worker 地址：https://flora-domain-info.soul-ai-frontend.workers.dev/。
- 版本：06913833-3b48-4fc3-a8ee-11ffa6d5d429。
- 页面：`/`、`/pricing`、`/terms`、`/privacy`、`/refunds`、`/contact`。
- 源码：`workers/domain-info/`。不导入主站应用，无数据库、模型密钥、支付密钥和绑定，不发布本地体验账号或 SQLite 数据。
- 明确说明付费尚未开放、价格和币种待公布、Waffo Pancake 计划接入。套餐交付与退款规则需在正式开卖前按实际方案更新，不视为 Waffo 已批准开户。
- 页面以 noindex 标记，公开可读供审核；待正式发布时决定索引策略。无需登录；没有表单、第三方脚本或收银台。
- 本地预览：`node scripts/preview-domain-site.mjs`，地址 http://127.0.0.1:3101/，与 3100 的 V2 本地站隔离。
- 独立站发布：`npx wrangler deploy --config wrangler.domain-info.jsonc`。这会更新新域名的介绍站，正式付费版本切换需另行执行明确的上线步骤。

## 原站验证

部署前后检查：原站首页、`/daily` 返回 HTTP 200，两个旧网址仍 HTTP 301 到原站。三个原 Worker 的 modified_on 均与接入前完全一致：

| Worker | 未改变的部署时间 |
| --- | --- |
| flora | 2026-09-30T02:31:15.245615Z |
| ai-lenormand | 2026-09-30T01:21:36.587238Z |
| ai-lenormand-cloudflare-preview | 2026-09-30T01:21:36.58031Z |

新域名六个公开页面与 www HTTPS 首页均实测 HTTP 200；本地介绍站的应用 API 路径返回 404。未连接或迁移正式业务数据库，未改变原站环境变量、路由或登录配置，未推送 Git，未打包版本备份。

## 后续

用户已提供 Waffo 的专属验证记录，并已通过 Cloudflare DNS 控制台添加：

- 类型：TXT；名称：`_waffo-challenge.floralenormand.site`。
- 值：`waffo-verify=d9e917126269e012677b3c7ff3f89c6c`（公开 DNS 验证值，并非 API 密钥）。
- Cloudflare 与 Google 公共 DNS 的 HTTPS 查询均返回匹配的完整记录，DNS 状态 0。普通 UDP DNS 查询在本机网络中超时，未据此判断记录失败。
- 未点击 Waffo 后台的验证或提交审核按钮，不能将 DNS 配置成功称为 Waffo 审核通过。

提交审核前还需确定正式价格、币种、退款细则及平台要求的运营者信息。V3 模拟订单、支付与管理后台另按本地需求实施。
