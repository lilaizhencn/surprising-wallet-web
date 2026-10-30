// Isolated HTTP fixtures; no real tenant, payment, credentials or signer.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const {chromium}=await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const output=process.env.QA_OUTPUT || '/tmp/custody-console-withdrawal-qa';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>sessionStorage.setItem('surprising-wallet.session.v2',JSON.stringify({version:2,accountType:'tenant',expiresAt:'2099-01-01T00:00:00Z',tenantId:'22222222-2222-2222-2222-222222222222',userId:'11111111-1111-1111-1111-111111111111',tenantSlug:'fixture',email:'fixture@example.test',displayName:'Synthetic operator',role:'TENANT_ADMIN',scopes:['*']})));
const source={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',chain:'ETH',network:'sepolia',address:'0x'+'12'.repeat(20),subject:'user:42',label:'Synthetic source',metadata:{},source:'CONSOLE',status:'ACTIVE'};
const recipient='0x'+'34'.repeat(20),accepted=new Map(),refused=new Set(),posts=[],failures=[];
let mode='accepted-reply-lost',queryFails=false;
const historical={id:'history-1',custodyAddressId:source.id,sourceAddress:source.address,subject:source.subject,orderNo:'history-1',chain:'ETH',assetSymbol:'USDT',toAddress:recipient,amount:'9007199254740993.000000000000000001',fee:'0',networkFee:'0.000000000000000021',networkFeeAsset:'ETH',gasStatus:'SETTLED',status:'CONFIRMED',txHash:'0x'+'56'.repeat(32),createdAt:'2026-10-30T00:00:00Z'};
await context.route(url=>url.pathname.startsWith('/custody/'),async route=>{
  const request=route.request(),url=new URL(request.url());let status=200,data={};
  const body=request.postData()?JSON.parse(request.postData()):{};
  const key=request.headers()['idempotency-key'];
  if(url.pathname.endsWith('/resolve')) {
    assert(key);posts.push({key,body,path:url.pathname});
    const hash=createHash('sha256').update([body.fundingSource,body.custodyAddressId,body.subject,body.chain,body.assetSymbol,body.toAddress,body.amount,body.externalReference].join('\n')).digest('hex');
    const receipt=accepted.get(key);if(!receipt)refused.add(key);
    data={status:receipt?'ACCEPTED':'REJECTED',idempotencyKey:key,requestHash:hash,externalReference:body.externalReference,withdrawal:receipt??null};
  }else if(url.pathname.endsWith('/submission')) {
    status=queryFails?503:200;data=queryFails?{error:{message:'Synthetic status outage'}}:[...accepted.values()].filter(row=>row.externalReference===url.searchParams.get('reference'));
  }else if(url.pathname.endsWith('/withdrawals') && request.method()==='POST') {
    assert.match(key,/^console-/);assert.equal(body.confirmed,true);assert.equal(body.fundingSource,'ADDRESS');assert.equal(body.subject,'user:43');posts.push({key,body,path:url.pathname});
    await new Promise(resolve=>setTimeout(resolve,250));
    if(refused.has(key)) {status=422;data={error:{message:'permanently refused'}};}
    else if(accepted.has(key))data=accepted.get(key);
    else if(mode==='unaccepted') {status=503;data={error:{message:'Synthetic submission outage'}};}
    else {accepted.set(key,{...body,id:'payment-'+accepted.size,status:'FROZEN',fee:'0'});status=503;data={error:{message:'Synthetic accepted reply lost'}};}
  }else if(url.pathname.endsWith('/withdrawals'))data={items:[historical],total:1,limit:20,offset:0};
  else if(url.pathname.endsWith('/addresses'))data={items:[source],total:1,limit:200,offset:0};
  else if(url.pathname.endsWith('/gas-accounts'))data=[{chain:'ETH',nativeSymbol:'ETH',availableBalance:'2',lowBalance:false,status:'ACTIVE'}];
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
});
await context.addInitScript(()=>{
  window.__withdrawalTrace=[];
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('button'):null;
    if(button){window.__withdrawalTrace.push({action:button.textContent,at:Date.now()});window.__withdrawalTrace=window.__withdrawalTrace.slice(-100);}
  },true);
});
const page=await context.newPage();page.on('pageerror',error=>failures.push(error.message));
const shot=name=>page.screenshot({path:`${output}/${name}.png`,fullPage:true});
async function create() {
  await page.getByRole('button',{name:'Create withdrawal',exact:true}).click();
  await page.getByRole('combobox',{name:'Source custody address',exact:true}).click();
  await page.getByText('Synthetic source — '+source.address,{exact:true}).last().click();
  await page.getByRole('textbox',{name:'Withdrawal beneficiary',exact:true}).fill('user:43');
  await page.getByPlaceholder('USDT',{exact:true}).fill('USDT');
  await page.getByRole('textbox',{name:'Destination address',exact:true}).fill(recipient);
  await page.getByRole('spinbutton',{name:'Amount',exact:true}).fill('25');
  await page.getByRole('button',{name:'Review withdrawal',exact:true}).click();
  await page.getByRole('button',{name:'Confirm and freeze funds',exact:true}).click();
  await page.getByText('Result unknown',{exact:false}).first().waitFor();
  // Close the review surfaces; the original request remains persisted above the table.
  await page.getByRole('button',{name:'Go back',exact:true}).click();
  await page.locator('.ant-drawer-content-wrapper').getByRole('button',{name:'Close',exact:true}).click();
}
try {
  await page.goto('http://127.0.0.1:5185/console/withdrawals');
  await page.getByRole('heading',{name:'Withdrawals',exact:true}).waitFor();
  await page.getByText('9,007,199,254,740,993.000000000000000001 USDT',{exact:true}).waitFor();
  await page.getByText('0.000000000000000021 ETH',{exact:true}).waitFor({state:'attached'});
  await shot('console-fees-desktop');
  await create();assert.equal(accepted.size,1);const original=posts[0];
  await page.reload();await page.getByText(original.key,{exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Create withdrawal',exact:true}).isDisabled());
  const second=await context.newPage();await second.goto(page.url());await second.getByText(original.key,{exact:true}).waitFor();
  // A receipt may arrive from another tab between pointer-down and pointer-up on Retry.
  const retry=page.getByRole('button',{name:'Retry original request',exact:true});
  const box=await retry.boundingBox();assert(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await second.getByRole('button',{name:'Retry original request',exact:true}).evaluate(button=>button.click());
  await page.getByRole('button',{name:'Start another withdrawal',exact:true}).waitFor();
  await page.mouse.up();await page.waitForTimeout(350);
  assert.equal(await page.getByText(original.key,{exact:true}).count(),1,'a receipt must never turn the in-progress Retry click into Start another withdrawal');
  assert.equal(posts.filter(item=>item.path.endsWith('/withdrawals')).length,2);assert.equal(accepted.size,1);
  assert.equal(posts[1].key,original.key);assert.deepEqual(posts[1].body,original.body);await second.close();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('console-original-mobile');
  await page.getByRole('button',{name:'Query original request',exact:true}).click();
  await page.getByRole('button',{name:'Start another withdrawal',exact:true}).click();
  mode='unaccepted';await create();const neverAccepted=posts.at(-1).key;
  await page.getByRole('button',{name:'Close unaccepted request',exact:true}).click();
  await page.getByRole('button',{name:'OK',exact:true}).click();
  await page.getByText('Permanently refused',{exact:false}).first().waitFor();
  assert(refused.has(neverAccepted));assert.equal(accepted.size,1);await shot('console-refusal-mobile');
  await page.getByRole('button',{name:'Start another withdrawal',exact:true}).click();
  await page.getByRole('button',{name:'Create withdrawal',exact:true}).click({trial:true});
  assert(await page.getByRole('button',{name:'Create withdrawal',exact:true}).isEnabled());
  assert.deepEqual(failures,[]);
  await fs.writeFile(`${output}/result.json`,JSON.stringify({acceptedPayments:accepted.size,refusedIntents:refused.size,posts,failures},null,2));
  console.log(JSON.stringify({acceptedPayments:accepted.size,refusedIntents:refused.size,failures}));
}catch(error){await shot('failure');await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),posts,failures,local:await page.evaluate(()=>({intents:Object.keys(localStorage).filter(key=>key.startsWith('custody.withdrawal-intent:')).map(key=>({key,value:localStorage.getItem(key)})),clicks:window.__withdrawalTrace}))},null,2));throw error;}
finally{await browser.close();}
