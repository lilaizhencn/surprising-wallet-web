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
