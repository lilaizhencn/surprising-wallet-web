# Surprising Wallet Web

Public product site and operational Console for
[Surprising Wallet](https://github.com/lilaizhencn/surprising-wallet).

Built with React 19, Ant Design 6, Vite 8, and TypeScript.

## Console surfaces

- Platform tenant creation, status, and activity counts
- Tenant aggregate assets
- API/Console address creation and address lifecycle management
- Deposit and withdrawal records
- Console withdrawal creation
- API key scopes, one-time secrets, and revocation
- IPv4/IPv6 allowlist switch and rules
- Webhook creation, verification, activation, health, delivery history, and retry
- Tenant audit log

The wallet does not create a tenant's internal users. A tenant passes its own
customer/account identifier as an opaque address allocation reference.

## Local development

Requirements: Node.js 20.19+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

The development server runs on `http://127.0.0.1:5173` and proxies `/custody`
to `http://127.0.0.1:8002`.

For a separately deployed backend:

```bash
cp .env.example .env.production
pnpm build
```

`VITE_CUSTODY_API_BASE` must be the public HTTPS wallet API origin. It is
embedded into the browser bundle and must never contain a secret.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```

Deploy `dist/` as a single-page application and route unknown paths to
`index.html`. The backend `SW_CUSTODY_CORS_ORIGINS` must contain the exact
Console origin.

### 提现金额与链费

托管提现金额表示链上收款本金；Gas 从租户 Gas 账户独立预留并按实际回执结算，列表单独显示实际链费与结算状态。尚未观察到实际链费时显示「—」。交易所的平台提现手续费由交易所报价与账务处理，不以托管预留或实际 Gas 代替。金额使用十进制字符串展示，保留最小单位。

控制台提现在发送前保存租户/操作员隔离的原请求，并通过 Web Locks 协调标签页；响应未知时只允许查询或重试原编号。关闭尚未受理的请求需要确认，并校验永久拒绝凭据的请求哈希；已经受理的单据继续处理。账户切换会清空只读请求缓存。可用 `scripts/withdrawal-closure-qa.mjs` 验证隔离 HTTP 故障场景。

资金池提现：交易所经 Core 可用余额授权后，以租户同链同资产本金池出款，独立保存提现用户。Gas 余额不参与本金；平台费用按原报价内扣，仅确认后入账。托管控制台地址出款须明确提现用户标识。


## Withdrawal approvals in the console

The Wallet console shows approvals at `/console/approvals` under the same public origin as the rest of the console. The Worker forwards `/approval/v1/*` to the separately deployed `wallet-approval` authority; it blocks public `/approval/service/*` and serves the normal console assets for all other routes. Set `VITE_APPROVAL_ORIGIN` to the console HTTPS origin. The tenant approval list uses the existing Wallet session. Every approve or reject action asks for the reviewer's own approval password and sends the immutable intent hash to the independent authority. Approval rules, reviewer management, and audit remain under `/console/approval-settings` with the independent administrator session. Keep approval runtime and deployment access separate from Wallet application access.

The tenant approval list refreshes every five seconds while visible and has a manual refresh button. Decisions require the approval password each time; the action creates no approval session. Policies support single amount, rolling 24-hour amount, first recipient and console withdrawal scenarios, with one or two independent reviewers. Decimal money fields are strings.

The complete final-transaction authorization and Wallet withdrawal integration are still being implemented. Do not deploy this feature as a completed production approval boundary yet.

New approval policies default to reviewing every withdrawal. The independent administrator can explicitly disable that preset and configure amount/recipient/console scenarios. Signing out aborts outstanding policy reads and clears prior tenant data; late responses cannot populate another tenant session.


Independent administrators can manage reviewers and inspect approval audits in the console settings page. Invitations bind a verified public Wallet subaccount UUID; the one-time 24-hour activation link is shown once and puts its capability in the URL fragment. Share it privately with the verified reviewer. The reviewer sets an 8–32 character approval password on first activation, without storing the token in local/session storage. Reset blocks the old password, revokes sessions and invalidates older links immediately; disabling clears activation and revokes sessions. Browser member controls manage APPROVER only; independent administrators remain under trusted host administration. Late responses from an unmounted administrator panel cannot reveal an old tenant's capability. Wallet user disable propagation and full chain authorization remain unfinished.


独立审核员停用传播（新增实现尚未统一验证）：Wallet 子账号停用或移除 APPROVER 会持久发送单向撤销，独立管理员页面显示撤销代次。重新邀请/重置前必须确认当前撤销记录；存在记录时页面要求核实本人及 Wallet 状态并明确勾选恢复授权。Wallet 启用/改密码不能恢复独立凭证，旧通知也不能重复停用已由独立管理员确认恢复的成员。邀请前增加同租户撤销查询，新交互尚未测试；此前前端通过记录不覆盖本次改动。
