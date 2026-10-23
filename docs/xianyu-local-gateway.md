> 2026-10-22 后续方案已切换为“闲鱼预存卡密 → Flora 兑换”，当前主流程见 `docs/xianyu-card-redemption.md`。本文件保留此前直充接口联调记录，直充开关仍关闭。

# 闲管家独立网关：本地联调准备

本地实现尚未接通真实支付。现有 V3 充值页继续使用原有模拟渠道；线上网站未修改。

## 当前可运行的代码

`node scripts/start-xianyu-gateway.cjs` 启动只监听 `127.0.0.1:3102` 的独立服务，复用隔离本地花瓣账本，不暴露网站、登录、后台或 AI 接口。不自动创建公网隧道、DNS、应用权限或商品。

网关实现的协议路径（均 POST）：

- `/goofish/open/info`：平台握手，仅返回应用编号。
- `/goofish/user/info`：签名认证的自研商户协议余额；按官方教程为自营单商户返回固定正整数，不代表用户钱包、真实资金或可提现金额。
- `/goofish/goods/list` 和 `/goofish/goods/detail`：三档固定价套餐（4.99／14.99／24.99 元，已取消首充半价），直充参数为“网站充值码”。
- `/goofish/order/recharge/create`：验签、服务器查单后核对卖家／商品／金额，再以数据库事务发放，重复订单不会重复发放。
- `/goofish/order/detail`：货源交付状态查询。交付查询会主动查询渠道并同步退款状态；尚未完成真实订单验证。

默认只允许握手和目录联调，`allowRecharge` 必须保持 false，直到真实商品映射、账号充值页面、退款处理和授权接口均验证完成。没有配置文件会直接退出，不以假凭据启动。

## 私有配置

实际文件位置为 `.local-paid/xianyu-config.json`，已被 Git 和源码备份排除。应用密钥不要发聊天、写入前端或提交 GitHub。以下仅是结构说明，不是可直接使用的配置：

```json
{
  "credentials": {
    "appId": "应用概况中的 AppKey",
    "appSecret": "应用概况中的 AppSecret",
    "merchantId": "网站自营商户编号",
    "merchantSecret": "网站自行生成并私下配置的随机商户密钥"
  },
  "allowRecharge": false,
  "products": []
}
```

`products` 在真实商品建立后保存可信映射：packageId（single/five/ten）、firstPurchase、goodsNo（flora-single-regular 等）、sellerIdentity（不可变 seller_eid）、productId、itemId。测试配置不得冒用其他商品或隐藏实际交付内容。

## 公网联调前的明确边界

1. 当前虚拟货源应用已上线，专业试用有效期至 2026-10-28。2026-10-22 用户明确同意仅开放独立支付接口的临时 HTTPS 联调入口。已有应用凭据已从用户登录的应用页面读取并安全写入私有配置，未输出密钥；本机生成的商户鉴权配置已保存到闲管家。
2. 闲管家保存网关时会访问平台和商户信息接口，单纯填写 localhost 无法通过。
3. 已启动 Cloudflare Quick Tunnel，仅转发 `127.0.0.1:3102`，没有修改 DNS 或现有网站。公网检查确认：握手和带签名商户信息成功；主页及管理后台路径 404；真实充值接口返回未启用。闲管家保存后已显示接口网关和“修改”按钮，说明平台信息与商户信息验证通过。临时 URL 与运行信息仅记录在 `.local-paid/xianyu-session.json`。
4. 网站充值码界面、订单列表、回到原问题和退款同步代码已补齐。仍需实际类目与直充商品、正式账号、真实订单查询权限和实付联调；完成后才启用真实充值。当前入口显示“套餐待开放”，不会提供未配置的购买链接。

2026-10-22 后续本地实现：迁移 008 保存原问题与退款状态；退款从闲鱼发起，网站主动查询后冻结本单未用花瓣，关闭退款则恢复，成功退款则调整，已使用／预留部分标记核对；退款不恢复首充。用户主页和独立管理后台均可查闲鱼订单。后台查询不执行真实资金退款。网关每分钟补查，页面刷新也会同步，每批最多并行查询 5 笔。新增端到端测试使用测试渠道响应，无真实付款。

商品文案：`docs/flora-xianyu-product-drafts.md`（本地草稿，未保存到闲管家或发布）；完整体验说明：`docs/xianyu-purchase-experience.md`。后台现有两件商品与 Flora 无关，未修改或关联。当前服务类目与虚拟货源直充范围尚未确认，不以无关资料／会员商品替代实际业务。

当前启动脚本强制要求 `allowRecharge=false`，即使误改为 true 也会拒绝启动。临时连接依赖本机网关与 cloudflared 进程，停止或重启隧道后地址失效／变化；正式上线需要固定服务地址。Cloudflare 工具从官方 GitHub 下载，Windows 发布者签名验证为 Cloudflare, Inc. 且有效。

## 验证

`node scripts/test.cjs lib/__tests__/xianyu-payments.test.ts` 覆盖官方签名样例、过期／伪造通知、固定官方 HTTPS 查单、防止将成本上限当作实付金额、重复发放、重启、首充冲突和握手模式关闭真实充值。

官方依据：

- https://s.apifox.cn/cf4d53fd-8bb2-41c5-8da3-371ba9a38956/doc-7646489
- https://s.apifox.cn/cf4d53fd-8bb2-41c5-8da3-371ba9a38956/doc-4985015
- https://s.apifox.cn/cf4d53fd-8bb2-41c5-8da3-371ba9a38956/api-205398512
- https://s.apifox.cn/3ac13d69-5a38-4536-ae9b-a54001854ef8/api-93586385

2026-10-22 应用启用后：店铺及商品只读接口均返回 100001“应用不存在或已下线”。官方自研教程明确这些 ERP 接口需要进销存类型 AppKey，现有应用类型为虚拟货源。尚未取得独立查询权限，不能开启真实充值。
