export type AccountSecurity = { userId: string; emailRequired: boolean; totpRequired: boolean; totpBound: boolean; emailDeliveryConfigured: boolean };
export type TotpSetup = { secret: string; uri: string; expiresAt: string };
