# Flora 正式域名检查（2026-10-22）

## 结论

适合小范围真实环境试运行。正式集中推广前仍有两项未完成：买家实付后的闲管家自动发码与网站兑换整链路验收；底层框架安全升级与兼容性回归。手机闲鱼 App 唤起也需真机确认。不能将接口测试通过视为真实付款已经验证。

## 已检查或处理

- 三个旧入口 `flora`、`ai-lenormand`、`ai-lenormand-cloudflare-preview` 已改用独立重定向 Worker，三个首页公网实测 301 到 `https://floralenormand.site/`。旧项目直达路径转 `/deep`；密码恢复参数保留，认证跳转不缓存；旧 POST 接口返回 410，不转发请求正文。旧 Supabase 数据不删除、不导入，遵循用户本次明确选择。
- Open Graph 继续使用原图，1200×630 JPEG、81,838 字节。新版本地址 `/og-flora-v3-20261022.jpg`，OG URL 与 canonical 指向正式域名，移除旧 OG 刷新参数。普通页面和 Facebook／Twitter／Telegram 等社交爬虫的独立预览路径均统一为该配置；爬虫预览走轻量 HTML，减少 Next 渲染。旧图片仍可访问。第三方平台既有分享卡片的缓存刷新由平台决定。
- 新站 `assets.run_worker_first=false`：匹配到的图片、JS、CSS、字体等由 Static Assets 分发，避免每个文件都调用 Worker。静态资产保留缓存，账户与余额接口不缓存。HTML 不缓存，避免发布后引用过期 JS 文件。
- 页面路径白名单让常见探测和测试入口在进入 Next 渲染前返回 404；不用的 HTML POST 与 Next Server Actions 在入口返回 405；真实业务仍使用明确的 JSON API。
- JSON API 先检查同源、请求方法及已声明长度；再做边缘突发限速。每个 IP 普通接口每分钟 600 次，密码恢复每分钟 10 次。该限制为同一边缘位置的近似限速，不能当作账户全局请求数或费用硬上限。后端还保留登录校验、账户限速、花瓣余额校验和码兑换限速。
- 私人页面发送 `X-Robots-Tag`，robots 限制 API、账户、项目详情及后台抓取；新增公开 sitemap。robots 由爬虫自愿遵守，不代替权限检查。
- 生成中的历史刷新从 3 秒改为 8 秒，页面在后台时暂停刷新；无生成任务时不轮询。
- 正式前端关闭额外的 workers.dev 与版本预览入口，只保留正式域名；三个旧 workers.dev 地址保留轻量跳转。
- 本地核心回归 65/65；新增流量、社交预览与购买链接检查 6/6；跳转脚本检查通过。构建及类型检查通过，发布产物扫描未发现真实密钥、私有卡密文件。

## 流量证据与限制

检查时过去 24 小时 Workers Analytics 共约 7,202 次请求：旧 flora 4,654，新站前端 2,130，新 API 261，其余两个旧入口合计 157。这里是请求量，包含客户端断开状态，不是独立访客数，也不是过去某次超额当天的报告。原始统计在私有 `.local-paid/cloudflare-launch-metrics.json`。

静态资源直接分发不会扣 Worker 脚本请求额度；SSR、接口、旧入口跳转仍涉及 Worker 调用。使用免费套餐时，账户内所有 Worker 脚本请求受共享每日额度约束。当前授权不能读取计费订阅，未更改任何套餐、账单或付费设置。

## 安全待办

当前 Next.js 为 14.2.35，已超出框架维护支持窗口。生产依赖树扫描报告共 47 条告警（3 critical、19 high、20 moderate、5 low），包含构建/适配工具的传递依赖；需要按实际运行环境逐项核对。Next 的 Windows 托管问题不对应 Cloudflare 运行环境，Image Optimizer 和 Server Actions 等未使用入口已阻断，但这不替代升级与回归。

检查时包仓库中可用的 Next 15 修复版本为 15.5.28。升级涉及 React 与路由参数接口兼容性，应在本地完成登录、项目历史、抽牌交互、AI 生成、充值兑换及部署适配回归后发布。本轮未变更框架主版本。

## 参考

- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/platform/limits/
- https://nextjs.org/docs/app/guides/upgrading/version-15
- https://github.com/advisories/GHSA-p293-qw3h-jr36
- https://github.com/advisories/GHSA-2xp9-vwfh-vxw4
