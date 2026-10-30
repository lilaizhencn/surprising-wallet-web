import type { Session } from '../auth/session';

export type WithdrawalValues = { subject: string; fundingSource?: 'ADDRESS'; custodyAddressId: string; chain: string; assetSymbol: string; toAddress: string; amount: string; externalReference?: string };
export type WithdrawalIntent = { key: string; owner: string; body: WithdrawalValues; receipt?: { id: string; status: string }; refusal?: { requestHash: string } };
const decimal = /^\d+(?:\.\d+)?$/;
export const withdrawalOwner = (session: Session) => `${session.tenantId}:${session.userId}`;
const storageKey = (owner: string) => `custody.withdrawal-intent:${owner}`;
export function readWithdrawalIntent(owner: string): WithdrawalIntent | null {
  const raw = localStorage.getItem(storageKey(owner));
  if (!raw) return null;
  if (raw.length > 8192) throw new Error('Saved withdrawal data is invalid; reconcile the original request.');
  const intent = JSON.parse(raw) as WithdrawalIntent;
  if (intent.owner !== owner || typeof intent.key !== 'string' || !/^console-[a-f0-9-]{36}$/.test(intent.key)
    || !intent.body || ['subject','custodyAddressId','chain','assetSymbol','toAddress','amount','externalReference'].some(field => typeof intent.body[field as keyof WithdrawalValues] !== 'string')
    || intent.body.fundingSource !== 'ADDRESS' || !intent.body.subject.trim() || intent.body.subject.length > 160
    || !decimal.test(intent.body.amount) || intent.body.amount.length > 120 || !intent.body.externalReference
    || intent.body.externalReference.length > 160 || intent.body.toAddress.length > 160
    || (intent.receipt && (!intent.receipt.id || !intent.receipt.status))
    || (intent.refusal && !/^[a-f0-9]{64}$/.test(intent.refusal.requestHash))) {
    throw new Error('Saved withdrawal data is invalid; reconcile the original request.');
  }
  return intent;
}
export function saveWithdrawalIntent(intent: WithdrawalIntent) {
  const raw = JSON.stringify(intent);
  localStorage.setItem(storageKey(intent.owner), raw);
  if (localStorage.getItem(storageKey(intent.owner)) !== raw) throw new Error('Cannot save the original withdrawal reference.');
}
export function prepareWithdrawalIntent(owner: string, values: WithdrawalValues): WithdrawalIntent {
  if (readWithdrawalIntent(owner)) throw new Error('Reconcile the original withdrawal before creating another.');
  const key = `console-${crypto.randomUUID()}`;
  const body={...values,fundingSource:'ADDRESS' as const,subject:values.subject.trim(),custodyAddressId:values.custodyAddressId.trim(),chain:values.chain.trim().toUpperCase(),assetSymbol:values.assetSymbol.trim().toUpperCase(),toAddress:values.toAddress.trim(),amount:String(values.amount).trim(),externalReference:values.externalReference?.trim()||key};
  if (!body.subject || body.subject.length > 160 || /[\x00-\x1f\x7f]/.test(body.subject)) throw new Error('Enter the withdrawal beneficiary.');
  const invalidText = (value: string, max: number) => !value || value.length > max || /[\x00-\x1f\x7f-\x9f]/.test(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.custodyAddressId)
    || !/^[A-Z][A-Z0-9_]{1,31}$/.test(body.chain) || !/^[A-Z][A-Z0-9_]{1,31}$/.test(body.assetSymbol)
    || invalidText(body.toAddress,160) || invalidText(body.externalReference,160) || invalidText(body.subject,160)) {
    throw new Error('Withdrawal identity fields are invalid. Correct them before confirming.');
  }
  if (!decimal.test(body.amount) || body.amount.length>120 || !/[1-9]/.test(body.amount)
    || (body.amount.split('.')[1]?.length ?? 0)>36 || body.amount.replace('.','').replace(/^0+/,'').length>78) {
    throw new Error('Enter a positive decimal amount within the supported precision.');
  }
  const intent = { key, owner, body };
  saveWithdrawalIntent(intent);
  return intent;
}
export function acceptWithdrawalIntent(intent: WithdrawalIntent, response: Record<string, unknown>): WithdrawalIntent {
  if (typeof response.id !== 'string' || !response.id || typeof response.status !== 'string'
    || !['CREATED','PENDING_REVIEW','FROZEN','SIGNING','SENT','BROADCAST_UNKNOWN','CONFIRMED','FAILED','REJECTED','CANCELLED'].includes(response.status)
    || response.subject !== intent.body.subject || response.fundingSource !== intent.body.fundingSource
    || response.custodyAddressId !== intent.body.custodyAddressId || response.externalReference !== intent.body.externalReference || response.chain !== intent.body.chain
    || response.assetSymbol !== intent.body.assetSymbol || response.toAddress !== intent.body.toAddress
    || typeof response.amount !== 'string' || !decimal.test(response.amount)) throw new Error('Withdrawal receipt does not match the saved original request.');
  const units = (value: string, scale: number) => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole + fraction.padEnd(scale,'0')); };
  const scale = Math.max(intent.body.amount.split('.')[1]?.length ?? 0,response.amount.split('.')[1]?.length ?? 0);
  if (response.amount.length > 120 || units(response.amount,scale) !== units(intent.body.amount,scale)) throw new Error('Withdrawal receipt amount differs from the original.');
  const accepted = { ...intent, receipt: { id: response.id, status: response.status } };
  saveWithdrawalIntent(accepted);
  return accepted;
}
export function clearWithdrawalIntent(intent: WithdrawalIntent) {
  const current = readWithdrawalIntent(intent.owner);
  if ((!current?.receipt && !current?.refusal) || current?.key !== intent.key) throw new Error('Confirm the original withdrawal first.');
  localStorage.removeItem(storageKey(intent.owner));
  if (localStorage.getItem(storageKey(intent.owner))) throw new Error('Cannot clear the original receipt.');
}
export async function resolveWithdrawalIntent(intent: WithdrawalIntent, response: Record<string,unknown>): Promise<WithdrawalIntent> {
  const body=intent.body;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode([body.fundingSource,body.custodyAddressId,body.subject,body.chain,body.assetSymbol,body.toAddress,body.amount,body.externalReference].join('\n')))),value=>value.toString(16).padStart(2,'0')).join('');
  if(response.idempotencyKey!==intent.key || response.externalReference!==body.externalReference || response.requestHash!==hash) throw new Error('Original submission decision does not match this request.');
  if(response.status==='ACCEPTED' && response.withdrawal && typeof response.withdrawal==='object') return acceptWithdrawalIntent(intent,response.withdrawal as Record<string,unknown>);
  if(response.status!=='REJECTED')throw new Error('Original submission decision is unknown.');
  const refused={...intent,refusal:{requestHash:hash}};
  saveWithdrawalIntent(refused);return refused;
}
export async function withWithdrawalLock<T>(owner: string, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('This browser cannot safely coordinate withdrawal tabs.');
  return navigator.locks.request(storageKey(owner), action);
}
