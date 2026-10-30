import { beforeEach, describe, expect, it } from 'vitest';
import { acceptWithdrawalIntent, clearWithdrawalIntent, prepareWithdrawalIntent, readWithdrawalIntent, resolveWithdrawalIntent } from '../utils/withdrawalIntent';
const owner='tenant:user';
const values={subject:'user:43',custodyAddressId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',chain:'ETH',assetSymbol:'USDT',toAddress:'0x'+'34'.repeat(20),amount:'25'};
const receipt=(intent:ReturnType<typeof prepareWithdrawalIntent>)=>({...intent.body,id:'payment-1',status:'FROZEN'});
beforeEach(()=>localStorage.clear());
describe('durable custody console submissions',()=>{
  it('saves the immutable reference before sending and blocks a replacement after reload',()=>{
    const first=prepareWithdrawalIntent(owner,values);
    expect(readWithdrawalIntent(owner)).toEqual(first);
    expect(first.body.externalReference).toBe(first.key);
    expect(()=>prepareWithdrawalIntent(owner,{...values,amount:'26'})).toThrow('original');
    expect(()=>clearWithdrawalIntent(first)).toThrow();
    expect(readWithdrawalIntent('another:owner')).toBeNull();
  });
  it('requires a receipt for the exact source, address, reference and decimal amount',()=>{
    const original=prepareWithdrawalIntent(owner,values);
    for(const patch of [{subject:'user:42'},{fundingSource:'TENANT_POOL'},{amount:'26'},{amount:25},{externalReference:'wrong'},{custodyAddressId:'another-source'},{toAddress:'another-recipient'},{status:'UNKNOWN_NEW_ENUM'}]) {
      expect(()=>acceptWithdrawalIntent(original,{...receipt(original),...patch})).toThrow();
      expect(readWithdrawalIntent(owner)?.receipt).toBeUndefined();
    }
    const accepted=acceptWithdrawalIntent(original,{...receipt(original),amount:'25.000000000000000000'});
    expect(readWithdrawalIntent(owner)?.receipt?.id).toBe('payment-1');
    clearWithdrawalIntent(accepted);expect(readWithdrawalIntent(owner)).toBeNull();
  });
  it('retains minimum units beyond IEEE-754 without rounding the receipt',()=>{
    const original=prepareWithdrawalIntent(owner,{...values,amount:'9007199254740993.000000000000000001'});
    expect(()=>acceptWithdrawalIntent(original,{...receipt(original),amount:'9007199254740993.000000000000000000'})).toThrow();
    expect(acceptWithdrawalIntent(original,receipt(original)).body.amount).toBe('9007199254740993.000000000000000001');
  });
  it('never treats an unbound refusal or a plain error as proof of nonacceptance',async()=>{
    const original=prepareWithdrawalIntent(owner,values);
    for(const response of [{status:409},{status:'REJECTED',idempotencyKey:original.key,externalReference:original.body.externalReference,requestHash:'wrong'}]) {
      await expect(resolveWithdrawalIntent(original,response)).rejects.toThrow();
      expect(readWithdrawalIntent(owner)?.refusal).toBeUndefined();
    }
  });
  it('rejects locally invalid identity or precision before saving an intent that cannot be resolved',()=>{
    for(const patch of [{assetSymbol:'bad symbol'},{chain:'?'},{custodyAddressId:'wrong'},{subject:'user:\n43'},{externalReference:'external\nreference'},{toAddress:'recipient\taddress'},{amount:'0.'+'0'.repeat(36)+'1'}]) {
      expect(()=>prepareWithdrawalIntent(owner,{...values,...patch})).toThrow();
      expect(readWithdrawalIntent(owner)).toBeNull();
    }
  });
  it('fails closed on corrupted storage instead of creating a second payment',()=>{
    const original=prepareWithdrawalIntent(owner,values);
    localStorage.setItem(`custody.withdrawal-intent:${owner}`,'broken');
    expect(()=>readWithdrawalIntent(owner)).toThrow();
    expect(()=>prepareWithdrawalIntent(owner,values)).toThrow();
    expect(original.body.amount).toBe('25');
  });
});
