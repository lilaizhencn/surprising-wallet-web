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
