export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export type TenantSummary = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  derivationNamespace: number;
  ipAllowlistEnabled: boolean;
  displayCurrency: string;
  addressCount: number;
  depositCount: number;
  withdrawalCount: number;
  activeWebhookCount: number;
  activeApiKeyCount: number;
  gasAccountCount: number;
  failedWebhookDeliveryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TenantPageResponse = {
  items: TenantSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type TenantRecord = Pick<
  TenantSummary,
  | 'id'
  | 'slug'
  | 'name'
  | 'status'
  | 'derivationNamespace'
  | 'ipAllowlistEnabled'
  | 'displayCurrency'
  | 'createdAt'
  | 'updatedAt'
>;

export type TenantStatistics = {
  addressCount: number;
  depositCount: number;
  withdrawalCount: number;
  activeApiKeyCount: number;
  activeWebhookCount: number;
  gasAccountCount: number;
  failedWebhookDeliveryCount: number;
  userCount: number;
  activeSessionCount: number;
};

export type TenantOnboarding = {
  apiKeyConfigured: boolean;
  webhookConfigured: boolean;
  ipAllowlistConfigured: boolean;
  addressCreated: boolean;
  gasAccountConfigured: boolean;
  gasAccountFunded: boolean;
  completedSteps: number;
  totalSteps: number;
  ready: boolean;
};

export type TenantAdministrator = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  failedLoginCount: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantAsset = {
  chain: string;
  assetSymbol: string;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  addressCount: number;
};

export type TenantAddress = {
  id: string;
  chain: string;
  network: string;
  address: string;
  memo?: string | null;
  externalReference?: string | null;
  label?: string | null;
  source: string;
  status: string;
  createdAt: string;
};

export type TenantGasAccount = {
  id: string;
  chain: string;
  network: string;
  nativeSymbol: string;
  address: string;
  memo?: string | null;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  lowBalanceThreshold: string | number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantApiKey = {
  id: string;
  keyId: string;
  name: string;
  scopes: string[];
  status: string;
  lastUsedAt?: string | null;
  lastUsedIp?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
};

export type TenantIpRule = {
  id: string;
  label: string;
  cidr: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TenantWebhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: string;
  verifiedAt?: string | null;
  lastDeliveryAt?: string | null;
  deliveryCount24h: number;
  successRate24h?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantWebhookDelivery = {
  id: string;
  endpointId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: string;
  totalAttemptCount: number;
  manualRetryCount: number;
  nextAttemptAt?: string | null;
  lastHttpStatus?: number | null;
  lastError?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
};

export type TenantDeposit = {
  id: string;
  externalReference?: string | null;
  chain: string;
  assetSymbol: string;
  txHash: string;
  amount: string | number;
  status: string;
  creditedAt?: string | null;
  createdAt: string;
};

export type TenantWithdrawal = {
  id: string;
  orderNo: string;
  externalReference?: string | null;
  chain: string;
  assetSymbol: string;
  toAddress: string;
  amount: string | number;
  fee: string | number;
  txHash?: string | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
};

export type TenantAuditEntry = {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  sourceIp?: string | null;
  details: string;
  createdAt: string;
};

export type TenantDetail = {
  tenant: TenantRecord;
  statistics: TenantStatistics;
  onboarding: TenantOnboarding;
  administrators: TenantAdministrator[];
  assets: TenantAsset[];
  recentAddresses: TenantAddress[];
  gasAccounts: TenantGasAccount[];
  apiKeys: TenantApiKey[];
  ipRules: TenantIpRule[];
  webhooks: TenantWebhook[];
  webhookDeliveries: TenantWebhookDelivery[];
  recentDeposits: TenantDeposit[];
  recentWithdrawals: TenantWithdrawal[];
  recentAudit: TenantAuditEntry[];
};
