import { Alert, Card, Collapse, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { CollapseProps, TableColumnsType } from 'antd';
import { ApiOutlined, CheckCircleOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../i18n';

const { Paragraph, Text, Title } = Typography;

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="developer-code">
      <Paragraph copyable={{ text: children }}>
        <pre>{children}</pre>
      </Paragraph>
    </div>
  );
}

type DemoLanguage = 'javascript' | 'java' | 'go' | 'python' | 'php';
type CodeSamples = Record<DemoLanguage, string>;

const demoLanguages: { key: DemoLanguage; label: string }[] = [
  { key: 'javascript', label: 'JavaScript' },
  { key: 'java', label: 'Java' },
  { key: 'go', label: 'Go' },
  { key: 'python', label: 'Python' },
  { key: 'php', label: 'PHP' },
];

function CodeTabs({ samples }: { samples: CodeSamples }) {
  return (
    <Tabs
      className="developer-code-tabs"
      items={demoLanguages.map((language) => ({
        key: language.key,
        label: language.label,
        children: <CodeBlock>{samples[language.key]}</CodeBlock>,
      }))}
    />
  );
}

const signedClient = `// custody-client.mjs (Node.js 18+)
import crypto from 'node:crypto';

const BASE_URL = 'https://api.example.com';
const KEY_ID = process.env.CUSTODY_KEY_ID;
const SECRET = process.env.CUSTODY_SECRET;

export async function custodyRequest(method, requestTarget, body, extraHeaders = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(18).toString('base64url');
  const bodyHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonical = [timestamp, nonce, method.toUpperCase(), requestTarget, bodyHash].join('\\n');
  const signature = crypto.createHmac('sha256', SECRET)
    .update(canonical)
    .digest('base64url');

  const response = await fetch(BASE_URL + requestTarget, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Custody-Key': KEY_ID,
      'X-Custody-Timestamp': timestamp,
      'X-Custody-Nonce': nonce,
      'X-Custody-Signature': signature,
      ...extraHeaders,
    },
    body: payload || undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}`;

const signedClients: CodeSamples = {
  javascript: signedClient,
  java: `// Java 17+，JSON 使用 Jackson databind
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;

public final class CustodyClient {
  private static final String BASE_URL = "https://api.example.com";
  private static final String KEY_ID = System.getenv("CUSTODY_KEY_ID");
  private static final String SECRET = System.getenv("CUSTODY_SECRET");
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  public static String request(String method, String target, Object body,
                               Map<String, String> extraHeaders) throws Exception {
    byte[] payload = body == null ? new byte[0] : JSON.writeValueAsBytes(body);
    String timestamp = Long.toString(Instant.now().getEpochSecond());
    String nonce = UUID.randomUUID().toString().replace("-", "");
    String bodyHash = HexFormat.of().formatHex(
        MessageDigest.getInstance("SHA-256").digest(payload));
    String canonical = String.join("\\n", timestamp, nonce,
        method.toUpperCase(Locale.ROOT), target, bodyHash);
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String signature = Base64.getUrlEncoder().withoutPadding()
        .encodeToString(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));

    HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(BASE_URL + target))
        .header("Content-Type", "application/json")
        .header("X-Custody-Key", KEY_ID)
        .header("X-Custody-Timestamp", timestamp)
        .header("X-Custody-Nonce", nonce)
        .header("X-Custody-Signature", signature)
        .method(method, payload.length == 0
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofByteArray(payload));
    extraHeaders.forEach(builder::header);
    HttpResponse<String> response = HTTP.send(
        builder.build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) throw new IllegalStateException(response.body());
    return response.body();
  }
}`,
  go: `// Go 1.22+，仅使用标准库
package custody

import (
  "bytes"
  "crypto/hmac"
  "crypto/rand"
  "crypto/sha256"
  "encoding/base64"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "os"
  "strconv"
  "strings"
  "time"
)

func custodyRequest(method, target string, body any, extra map[string]string) ([]byte, error) {
  payload := []byte{}
  var err error
  if body != nil { payload, err = json.Marshal(body); if err != nil { return nil, err } }
  timestamp := strconv.FormatInt(time.Now().Unix(), 10)
  nonceBytes := make([]byte, 18)
  if _, err = rand.Read(nonceBytes); err != nil { return nil, err }
  nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)
  digest := sha256.Sum256(payload)
  canonical := strings.Join([]string{timestamp, nonce, strings.ToUpper(method), target,
    hex.EncodeToString(digest[:])}, "\\n")
  mac := hmac.New(sha256.New, []byte(os.Getenv("CUSTODY_SECRET")))
  mac.Write([]byte(canonical))
  signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

  req, err := http.NewRequest(method, "https://api.example.com"+target, bytes.NewReader(payload))
  if err != nil { return nil, err }
  req.Header.Set("Content-Type", "application/json")
  req.Header.Set("X-Custody-Key", os.Getenv("CUSTODY_KEY_ID"))
  req.Header.Set("X-Custody-Timestamp", timestamp)
  req.Header.Set("X-Custody-Nonce", nonce)
  req.Header.Set("X-Custody-Signature", signature)
  for key, value := range extra { req.Header.Set(key, value) }
  resp, err := http.DefaultClient.Do(req)
  if err != nil { return nil, err }
  defer resp.Body.Close()
  result, err := io.ReadAll(resp.Body)
  if resp.StatusCode >= 400 { return nil, fmt.Errorf("custody API: %s", result) }
  return result, err
}`,
  python: `# Python 3.11+；pip install requests
import base64, hashlib, hmac, json, os, secrets, time
import requests

BASE_URL = "https://api.example.com"
KEY_ID = os.environ["CUSTODY_KEY_ID"]
SECRET = os.environ["CUSTODY_SECRET"]

def custody_request(method, target, body=None, extra_headers=None):
    payload = "" if body is None else json.dumps(body, separators=(",", ":"), ensure_ascii=False)
    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(18)
    body_hash = hashlib.sha256(payload.encode()).hexdigest()
    canonical = "\\n".join([timestamp, nonce, method.upper(), target, body_hash])
    signature = base64.urlsafe_b64encode(
        hmac.new(SECRET.encode(), canonical.encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    headers = {
        "Content-Type": "application/json",
        "X-Custody-Key": KEY_ID,
        "X-Custody-Timestamp": timestamp,
        "X-Custody-Nonce": nonce,
        "X-Custody-Signature": signature,
        **(extra_headers or {}),
    }
    response = requests.request(method, BASE_URL + target, data=payload or None,
                                headers=headers, timeout=15)
    response.raise_for_status()
    return response.json() if response.content else None`,
  php: `<?php // PHP 8.2+
final class CustodyClient {
    public function request(string $method, string $target, ?array $body = null,
                            array $extraHeaders = []): mixed {
        $payload = $body === null ? '' : json_encode(
            $body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $timestamp = (string) time();
        $nonce = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
        $canonical = implode("\\n", [
            $timestamp, $nonce, strtoupper($method), $target, hash('sha256', $payload)
        ]);
        $signature = rtrim(strtr(base64_encode(
            hash_hmac('sha256', $canonical, getenv('CUSTODY_SECRET'), true)
        ), '+/', '-_'), '=');
        $headers = array_merge([
            'Content-Type: application/json',
            'X-Custody-Key: ' . getenv('CUSTODY_KEY_ID'),
            'X-Custody-Timestamp: ' . $timestamp,
            'X-Custody-Nonce: ' . $nonce,
            'X-Custody-Signature: ' . $signature,
        ], array_map(fn($k, $v) => "$k: $v", array_keys($extraHeaders), $extraHeaders));
        $curl = curl_init('https://api.example.com' . $target);
        curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $payload ?: null, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15]);
        $response = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($response === false || $status >= 400) throw new RuntimeException((string) $response);
        return $response === '' ? null : json_decode($response, true, flags: JSON_THROW_ON_ERROR);
    }
}`,
};

type ApiDoc = {
  key: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  demo: string;
  response: string;
  notes: string;
};

const apiDocs: ApiDoc[] = [
  {
    key: 'chains', method: 'GET', path: '/custody/api/v1/chains',
    title: '查询已开通链',
    description: '只返回平台可执行且当前租户已经开通的链。创建地址和提现前应先调用此接口。',
    demo: `const chains = await custodyRequest('GET', '/custody/api/v1/chains');`,
    response: `[
  {
    "chain": "ARBITRUM",
    "network": "mainnet",
    "family": "evm",
    "nativeSymbol": "ETH",
    "assetSymbols": ["ETH", "USDT", "USDC"],
    "enabled": true,
    "scanEnabled": true,
    "withdrawalEnabled": true
  }
]`,
    notes: 'chain 是平台链标识，不是 network 名称。enabled=false 的链不会从本接口返回。',
  },
  {
    key: 'create-address', method: 'POST', path: '/custody/api/v1/addresses',
    title: '生成充值地址',
    description: '获取或生成租户业务主体在指定链的稳定充值地址。链必须已经开通。',
    demo: `const address = await custodyRequest('POST', '/custody/api/v1/addresses', {
  chainId: 'ARBITRUM',
  subject: 'user_10086',
  addressVersion: 0
});`,
    response: `{
  "id": "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
  "chain": "ARBITRUM",
  "network": "mainnet",
  "address": "0x1234...abcd",
  "memo": null,
  "subject": "user_10086",
  "addressVersion": 0,
  "source": "API",
  "status": "ACTIVE",
  "createdAt": "2026-07-21T08:00:00Z"
}`,
    notes: 'subject 是租户自己的用户/账户稳定标识，addressVersion 省略时为 0。同一租户、链、subject 和版本重复请求返回原地址；同一 subject + 版本在所有 EVM 链返回相同地址。用户需要更换地址时递增版本，旧地址仍继续监听。memo 非空时，入账必须同时匹配 address 和 memo。',
  },
  {
    key: 'list-addresses', method: 'GET', path: '/custody/api/v1/addresses',
    title: '查询充值地址',
    description: '按链、状态或 subject/address 关键字查询本租户地址。',
    demo: `const addresses = await custodyRequest(
  'GET',
  '/custody/api/v1/addresses?chain=ARBITRUM&status=ACTIVE&search=user_10086&limit=50&offset=0'
);`,
    response: `[
  {
    "id": "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
    "chain": "ARBITRUM",
    "network": "mainnet",
    "address": "0x1234...abcd",
    "memo": null,
    "subject": "user_10086",
    "addressVersion": 0,
    "status": "ACTIVE"
  }
]`,
    notes: '签名中的 requestTarget 必须包含完整查询字符串，且顺序、大小写和实际发送的 URL 完全一致。limit 最大 200。',
  },
  {
    key: 'assets', method: 'GET', path: '/custody/api/v1/assets',
    title: '查询链和 Token 资产',
    description: '返回当前租户按 chain + assetSymbol 聚合的可用、锁定和总余额。',
    demo: `const assets = await custodyRequest('GET', '/custody/api/v1/assets');`,
    response: `[
  {
    "chain": "ARBITRUM",
    "assetSymbol": "USDT",
    "availableBalance": 1250.25,
    "lockedBalance": 50,
    "totalBalance": 1300.25,
    "addressCount": 18
  }
]`,
    notes: 'assetSymbol 表示 Token/原生币符号。同一个 USDT 在不同 chain 上是独立资产，跨链汇总请按 assetSymbol 再聚合。金额禁止用浮点数参与账务计算。',
  },
  {
    key: 'deposits', method: 'GET', path: '/custody/api/v1/deposits',
    title: '查询充值记录',
    description: '查询已识别到本租户地址的链上充值和确认状态。',
    demo: `const deposits = await custodyRequest(
  'GET',
  '/custody/api/v1/deposits?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=user_10086&limit=50&offset=0'
);`,
    response: `[
  {
    "id": "bfc248e6-a5f5-44bc-b69d-26434072eebb",
    "custodyAddressId": "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
    "subject": "user_10086",
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "chain": "ARBITRUM",
    "assetSymbol": "USDT",
    "txHash": "0xabc...789",
    "logIndex": 3,
    "amount": 100,
    "status": "CONFIRMED",
    "creditedAt": "2026-07-21T08:05:00Z"
  }
]`,
    notes: '可按 chain、assetSymbol、status 精确过滤；search 匹配 txHash、完整充值地址、subject 或 label。txHash 即常说的 txid。Token 转账必须用 chain + txHash + logIndex 唯一定位。',
  },
  {
    key: 'create-withdrawal', method: 'POST', path: '/custody/api/v1/withdrawals',
    title: '创建提现',
    description: '从指定托管地址发起链上提现。链必须开通，并要求请求级幂等键和显式确认。',
    demo: `const withdrawal = await custodyRequest(
  'POST',
  '/custody/api/v1/withdrawals',
  {
    custodyAddressId: '8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef',
    chain: 'ARBITRUM',
    assetSymbol: 'USDT',
    toAddress: '0xabcd...1234',
    amount: '25.50',
    externalReference: 'merchant_order_20260721_001',
    confirmed: true
  },
  { 'Idempotency-Key': 'withdrawal-merchant-order-20260721-001' }
);`,
    response: `{
  "id": "4ec53331-d178-46a6-a991-68409fe80280",
  "custodyAddressId": "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
  "orderNo": "CW-acme-8eca3ed7-000001",
  "externalReference": "merchant_order_20260721_001",
  "chain": "ARBITRUM",
  "assetSymbol": "USDT",
  "toAddress": "0xabcd...1234",
  "amount": 25.50,
  "fee": 0.12,
  "status": "FROZEN",
  "txHash": null,
  "errorMessage": null
}`,
    notes: 'amount 必须作为十进制字符串提交。相同 Idempotency-Key + 相同参数返回原结果；相同键配不同参数会被拒绝。confirmed 必须为 true。',
  },
  {
    key: 'withdrawals', method: 'GET', path: '/custody/api/v1/withdrawals',
    title: '查询提现记录',
    description: '查询提现状态、平台订单号、业务关联号和最终链上交易哈希。',
    demo: `const withdrawals = await custodyRequest(
  'GET',
  '/custody/api/v1/withdrawals?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=merchant_order_20260721_001&limit=50&offset=0'
);`,
    response: `[
  {
    "id": "4ec53331-d178-46a6-a991-68409fe80280",
    "orderNo": "CW-acme-8eca3ed7-000001",
    "externalReference": "merchant_order_20260721_001",
    "sourceAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "subject": "merchant_treasury",
    "chain": "ARBITRUM",
    "assetSymbol": "USDT",
    "amount": 25.50,
    "fee": 0.12,
    "status": "CONFIRMED",
    "txHash": "0xdef...456",
    "errorMessage": null
  }
]`,
    notes: 'txHash 在广播前可能为 null。请根据状态机处理，不要把“已创建”当成“链上确认”。',
  },
];

const endpointDemos: Record<string, CodeSamples> = {
  chains: {
    javascript: apiDocs[0].demo,
    java: `String chains = CustodyClient.request("GET", "/custody/api/v1/chains",
    null, Map.of());`,
    go: `chains, err := custodyRequest("GET", "/custody/api/v1/chains", nil, nil)`,
    python: `chains = custody_request("GET", "/custody/api/v1/chains")`,
    php: `$chains = (new CustodyClient())->request('GET', '/custody/api/v1/chains');`,
  },
  'create-address': {
    javascript: apiDocs[1].demo,
    java: `String address = CustodyClient.request("POST", "/custody/api/v1/addresses",
    Map.of("chainId", "ARBITRUM", "subject", "user_10086", "addressVersion", 0), Map.of());`,
    go: `address, err := custodyRequest("POST", "/custody/api/v1/addresses",
  map[string]any{"chainId": "ARBITRUM", "subject": "user_10086", "addressVersion": 0}, nil)`,
    python: `address = custody_request("POST", "/custody/api/v1/addresses", {
    "chainId": "ARBITRUM",
    "subject": "user_10086",
    "addressVersion": 0,
})`,
    php: `$address = (new CustodyClient())->request('POST', '/custody/api/v1/addresses', [
    'chainId' => 'ARBITRUM',
    'subject' => 'user_10086',
    'addressVersion' => 0,
]);`,
  },
  'list-addresses': {
    javascript: apiDocs[2].demo,
    java: `String target = "/custody/api/v1/addresses?chain=ARBITRUM&status=ACTIVE"
    + "&search=user_10086&limit=50&offset=0";
String addresses = CustodyClient.request("GET", target, null, Map.of());`,
    go: `target := "/custody/api/v1/addresses?chain=ARBITRUM&status=ACTIVE" +
  "&search=user_10086&limit=50&offset=0"
addresses, err := custodyRequest("GET", target, nil, nil)`,
    python: `target = ("/custody/api/v1/addresses?chain=ARBITRUM&status=ACTIVE"
          "&search=user_10086&limit=50&offset=0")
addresses = custody_request("GET", target)`,
    php: `$target = '/custody/api/v1/addresses?chain=ARBITRUM&status=ACTIVE'
    . '&search=user_10086&limit=50&offset=0';
$addresses = (new CustodyClient())->request('GET', $target);`,
  },
  assets: {
    javascript: apiDocs[3].demo,
    java: `String assets = CustodyClient.request("GET", "/custody/api/v1/assets",
    null, Map.of());`,
    go: `assets, err := custodyRequest("GET", "/custody/api/v1/assets", nil, nil)`,
    python: `assets = custody_request("GET", "/custody/api/v1/assets")`,
    php: `$assets = (new CustodyClient())->request('GET', '/custody/api/v1/assets');`,
  },
  deposits: {
    javascript: apiDocs[4].demo,
    java: `String deposits = CustodyClient.request("GET",
    "/custody/api/v1/deposits?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=user_10086&limit=50&offset=0",
    null, Map.of());`,
    go: `deposits, err := custodyRequest("GET",
  "/custody/api/v1/deposits?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=user_10086&limit=50&offset=0", nil, nil)`,
    python: `deposits = custody_request(
    "GET", "/custody/api/v1/deposits?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=user_10086&limit=50&offset=0"
)`,
    php: `$deposits = (new CustodyClient())->request(
    'GET', '/custody/api/v1/deposits?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=user_10086&limit=50&offset=0'
);`,
  },
  'create-withdrawal': {
    javascript: apiDocs[5].demo,
    java: `Map<String, Object> body = Map.of(
    "custodyAddressId", "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
    "chain", "ARBITRUM", "assetSymbol", "USDT",
    "toAddress", "0xabcd...1234", "amount", "25.50",
    "externalReference", "merchant_order_20260721_001", "confirmed", true);
String withdrawal = CustodyClient.request("POST", "/custody/api/v1/withdrawals", body,
    Map.of("Idempotency-Key", "withdrawal-merchant-order-20260721-001"));`,
    go: `body := map[string]any{
  "custodyAddressId": "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
  "chain": "ARBITRUM", "assetSymbol": "USDT", "toAddress": "0xabcd...1234",
  "amount": "25.50", "externalReference": "merchant_order_20260721_001",
  "confirmed": true,
}
withdrawal, err := custodyRequest("POST", "/custody/api/v1/withdrawals", body,
  map[string]string{"Idempotency-Key": "withdrawal-merchant-order-20260721-001"})`,
    python: `withdrawal = custody_request("POST", "/custody/api/v1/withdrawals", {
    "custodyAddressId": "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
    "chain": "ARBITRUM", "assetSymbol": "USDT", "toAddress": "0xabcd...1234",
    "amount": "25.50", "externalReference": "merchant_order_20260721_001",
    "confirmed": True,
}, {"Idempotency-Key": "withdrawal-merchant-order-20260721-001"})`,
    php: `$withdrawal = (new CustodyClient())->request('POST', '/custody/api/v1/withdrawals', [
    'custodyAddressId' => '8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef',
    'chain' => 'ARBITRUM', 'assetSymbol' => 'USDT', 'toAddress' => '0xabcd...1234',
    'amount' => '25.50', 'externalReference' => 'merchant_order_20260721_001',
    'confirmed' => true,
], ['Idempotency-Key' => 'withdrawal-merchant-order-20260721-001']);`,
  },
  withdrawals: {
    javascript: apiDocs[6].demo,
    java: `String withdrawals = CustodyClient.request("GET",
    "/custody/api/v1/withdrawals?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=merchant_order_20260721_001&limit=50&offset=0",
    null, Map.of());`,
    go: `withdrawals, err := custodyRequest("GET",
  "/custody/api/v1/withdrawals?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=merchant_order_20260721_001&limit=50&offset=0", nil, nil)`,
    python: `withdrawals = custody_request(
    "GET", "/custody/api/v1/withdrawals?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=merchant_order_20260721_001&limit=50&offset=0"
)`,
    php: `$withdrawals = (new CustodyClient())->request(
    'GET', '/custody/api/v1/withdrawals?chain=ARBITRUM&assetSymbol=USDT&status=CONFIRMED&search=merchant_order_20260721_001&limit=50&offset=0'
);`,
  },
};

const webhookHandler = `// webhook-server.mjs (Express)
import crypto from 'node:crypto';
import express from 'express';

const app = express();
const WEBHOOK_SECRET = process.env.CUSTODY_WEBHOOK_SECRET;

app.post('/webhooks/custody', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body;
  const timestamp = req.header('X-Custody-Timestamp');
  const received = (req.header('X-Custody-Signature') || '').replace(/^v1=/, '');
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(timestamp + '.' + rawBody.toString('utf8'))
    .digest('base64url');

  const valid = received.length === expected.length && crypto.timingSafeEqual(
    Buffer.from(received), Buffer.from(expected)
  );
  if (!valid) return res.status(401).json({ error: 'invalid signature' });

  const event = JSON.parse(rawBody.toString('utf8'));
  // 先用 event.id 建唯一索引落库，再异步处理业务，避免重复入账。
  await saveEventOnce(event.id, event.type, event);

  if (event.type === 'WEBHOOK.VERIFICATION') {
    return res.status(200).json({ challenge: event.data.challenge });
  }
  return res.status(204).end();
});`;

const webhookHandlers: CodeSamples = {
  javascript: webhookHandler,
  java: `// Spring Boot：@RequestBody byte[] 保留原始请求体
@PostMapping("/webhooks/custody")
public ResponseEntity<?> webhook(
    @RequestBody byte[] rawBody,
    @RequestHeader("X-Custody-Timestamp") String timestamp,
    @RequestHeader("X-Custody-Signature") String signature) throws Exception {
  String received = signature.replaceFirst("^v1=", "");
  Mac mac = Mac.getInstance("HmacSHA256");
  mac.init(new SecretKeySpec(System.getenv("CUSTODY_WEBHOOK_SECRET")
      .getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
  mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
  String expected = Base64.getUrlEncoder().withoutPadding()
      .encodeToString(mac.doFinal(rawBody));
  if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
      received.getBytes(StandardCharsets.UTF_8))) {
    return ResponseEntity.status(401).build();
  }
  JsonNode event = objectMapper.readTree(rawBody);
  saveEventOnce(event.path("id").asText(), event.path("type").asText(), rawBody);
  if ("WEBHOOK.VERIFICATION".equals(event.path("type").asText())) {
    return ResponseEntity.ok(Map.of("challenge", event.path("data").path("challenge").asText()));
  }
  return ResponseEntity.noContent().build();
}`,
  go: `// net/http：先读取原始 body，再验签和解析 JSON
func custodyWebhook(w http.ResponseWriter, r *http.Request) {
  rawBody, err := io.ReadAll(r.Body)
  if err != nil { http.Error(w, "bad body", 400); return }
  timestamp := r.Header.Get("X-Custody-Timestamp")
  received := strings.TrimPrefix(r.Header.Get("X-Custody-Signature"), "v1=")
  mac := hmac.New(sha256.New, []byte(os.Getenv("CUSTODY_WEBHOOK_SECRET")))
  mac.Write([]byte(timestamp + "."))
  mac.Write(rawBody)
  expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
  if !hmac.Equal([]byte(expected), []byte(received)) {
    http.Error(w, "invalid signature", http.StatusUnauthorized); return
  }
  var event struct { ID, Type string; Data map[string]any }
  if json.Unmarshal(rawBody, &event) != nil { http.Error(w, "bad json", 400); return }
  saveEventOnce(event.ID, event.Type, rawBody)
  if event.Type == "WEBHOOK.VERIFICATION" {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]any{"challenge": event.Data["challenge"]})
    return
  }
  w.WriteHeader(http.StatusNoContent)
}`,
  python: `# Flask：request.get_data() 返回验签所需的原始请求体
import base64, hashlib, hmac, json, os
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.post("/webhooks/custody")
def custody_webhook():
    raw_body = request.get_data()
    timestamp = request.headers.get("X-Custody-Timestamp", "")
    received = request.headers.get("X-Custody-Signature", "").removeprefix("v1=")
    expected = base64.urlsafe_b64encode(hmac.new(
        os.environ["CUSTODY_WEBHOOK_SECRET"].encode(),
        timestamp.encode() + b"." + raw_body,
        hashlib.sha256,
    ).digest()).rstrip(b"=").decode()
    if not hmac.compare_digest(expected, received):
        return {"error": "invalid signature"}, 401
    event = json.loads(raw_body)
    save_event_once(event["id"], event["type"], event)
    if event["type"] == "WEBHOOK.VERIFICATION":
        return jsonify(challenge=event["data"]["challenge"])
    return "", 204`,
  php: `<?php // 原始请求体必须从 php://input 读取
$rawBody = file_get_contents('php://input');
$timestamp = $_SERVER['HTTP_X_CUSTODY_TIMESTAMP'] ?? '';
$received = preg_replace('/^v1=/', '', $_SERVER['HTTP_X_CUSTODY_SIGNATURE'] ?? '');
$digest = hash_hmac('sha256', $timestamp . '.' . $rawBody,
    getenv('CUSTODY_WEBHOOK_SECRET'), true);
$expected = rtrim(strtr(base64_encode($digest), '+/', '-_'), '=');
if (!hash_equals($expected, $received)) {
    http_response_code(401);
    exit;
}
$event = json_decode($rawBody, true, flags: JSON_THROW_ON_ERROR);
saveEventOnce($event['id'], $event['type'], $event);
if ($event['type'] === 'WEBHOOK.VERIFICATION') {
    header('Content-Type: application/json');
    echo json_encode(['challenge' => $event['data']['challenge']], JSON_THROW_ON_ERROR);
    exit;
}
http_response_code(204);`,
};

const depositWebhook = `{
  "id": "6928f589-7125-4436-8310-ea0e47a7ec91",
  "type": "DEPOSIT.CONFIRMED",
  "createdAt": "2026-07-21T08:05:00Z",
  "data": {
    "depositId": "bfc248e6-a5f5-44bc-b69d-26434072eebb",
    "subject": "user_10086",
    "chain": "ARBITRUM",
    "asset": "USDT",
    "address": "0x1234...abcd",
    "memo": null,
    "purpose": "CUSTOMER",
    "amount": 100,
    "txHash": "0xabc...789",
    "logIndex": 3,
    "blockHeight": 231004567,
    "confirmations": 24,
    "confirmedAt": "2026-07-21T08:05:00Z"
  }
}`;

const withdrawalWebhook = `{
  "id": "effcbf02-b0fb-4931-a82f-c83f12482c03",
  "type": "WITHDRAWAL.CONFIRMED",
  "createdAt": "2026-07-21T08:10:00Z",
  "data": {
    "withdrawalId": "4ec53331-d178-46a6-a991-68409fe80280",
    "custodyAddressId": "8eca3ed7-55f0-49d7-a5ef-c2fd7e9e34ef",
    "externalReference": "merchant_order_20260721_001",
    "orderNo": "CW-acme-8eca3ed7-000001",
    "chain": "ARBITRUM",
    "asset": "USDT",
    "toAddress": "0xabcd...1234",
    "amount": 25.50,
    "fee": 0.12,
    "status": "CONFIRMED",
    "txHash": "0xdef...456",
    "errorMessage": null
  }
}`;

const fieldRows = [
  { field: 'chain', meaning: '平台链标识，例如 ARBITRUM、ETH、TRON；调用写接口前租户必须已开通。' },
  { field: 'network', meaning: '链运行网络，例如 mainnet、sepolia、nile；不要用它代替 chain。' },
  { field: 'asset / assetSymbol', meaning: '原生币或 Token 符号，例如 ETH、USDT、USDC。回调使用 asset，API 使用 assetSymbol。' },
  { field: 'txHash', meaning: '链上交易标识，也就是常说的 txid。不同链格式不同，按原字符串保存。' },
  { field: 'logIndex', meaning: '交易内事件序号；Token 充值使用 chain + txHash + logIndex 做唯一键。' },
  { field: 'subject', meaning: '租户业务系统中的用户/账户稳定标识，用来关联充值地址和到账用户。' },
  { field: 'addressVersion', meaning: '地址业务版本，默认 0；需要给同一 subject 更换地址时递增。旧版本地址仍继续监听和入账。' },
  { field: 'custodyAddressId', meaning: '平台生成的托管地址 UUID，提现时用于指定资金来源。' },
  { field: 'externalReference', meaning: '租户自己的订单号/业务流水号，便于双方对账。' },
  { field: 'orderNo', meaning: '平台提现订单号；排障、查询和对账时应同时保留 orderNo 与 externalReference。' },
  { field: 'amount / fee', meaning: '十进制金额。请求时用字符串，业务计算使用 Decimal/BigDecimal，禁止浮点数。' },
  { field: 'memo', meaning: 'Memo/Tag 类链的附加定位信息；非空时必须与 address 一起匹配。' },
  { field: 'event.id', meaning: 'Webhook 事件 UUID。租户接收端必须以它作为幂等键，重复事件只处理一次。' },
];

export default function DeveloperDocsPage() {
  const { t } = useI18n();
  const endpointItems: CollapseProps['items'] = apiDocs.map((doc) => ({
    key: doc.key,
    label: (
      <Space wrap>
        <Tag color={doc.method === 'GET' ? 'blue' : 'green'}>{doc.method}</Tag>
        <Text code>{doc.path}</Text>
        <Text strong>{doc.title}</Text>
      </Space>
    ),
    children: (
      <div className="api-doc-detail">
        <Paragraph>{doc.description}</Paragraph>
        <Title level={5}>调用 Demo</Title>
        <CodeTabs samples={endpointDemos[doc.key]} />
        <Title level={5}>响应示例</Title>
        <CodeBlock>{doc.response}</CodeBlock>
        <Alert showIcon type="info" title="字段与接入提示" description={doc.notes} />
      </div>
    ),
  }));
  const fieldColumns: TableColumnsType<(typeof fieldRows)[number]> = [
    { title: '字段', dataIndex: 'field', width: 190, render: (value) => <Text code>{value}</Text> },
    { title: '含义与处理要求', dataIndex: 'meaning' },
  ];

  return (
    <div className="page-stack developer-docs">
      <PageHeader
        title={t('Developer documentation')}
        description={t('Integrate tenant chains, signed APIs, custody addresses, withdrawals, and verified webhooks.')}
      />

      <Alert
        showIcon
        type="warning"
        title="推荐接入顺序"
        description={(
          <span>
            先在 <Link to="/console/chains">租户链</Link> 开通链，再到 <Link to="/console/api-access">开发者接入</Link>
            创建最小权限密钥并配置、验证回调地址。Webhook 不需要选择订阅事件。
          </span>
        )}
      />

      <div className="developer-overview-grid">
        <Card><SafetyCertificateOutlined /><Title level={4}>1. 后台配置</Title><Paragraph>开通业务链，创建 API Key，按需启用 IP 白名单，并配置 Gas 账户。</Paragraph></Card>
        <Card><ApiOutlined /><Title level={4}>2. API 集成</Title><Paragraph>每次请求使用 HMAC 签名、唯一 nonce；提现额外使用 Idempotency-Key。</Paragraph></Card>
        <Card><LinkOutlined /><Title level={4}>3. 回调接收</Title><Paragraph>用原始请求体验签，以 event.id 幂等，快速返回 2xx 后异步处理业务。</Paragraph></Card>
        <Card><CheckCircleOutlined /><Title level={4}>4. 对账上线</Title><Paragraph>保存 chain、asset、txHash、logIndex、orderNo 和 externalReference，并核对最终状态。</Paragraph></Card>
      </div>

      <section className="data-panel docs-section">
        <Title level={2}>API 鉴权与签名</Title>
        <Paragraph>
          对外 API 统一使用 API Key 签名，不使用浏览器 Cookie。签名原文依次为
          <Text code>timestamp</Text>、<Text code>nonce</Text>、HTTP 方法、包含查询字符串的
          <Text code>requestTarget</Text>、请求体 SHA-256（十六进制），用换行连接。
          HMAC-SHA256 结果使用无填充 Base64URL。
        </Paragraph>
        <CodeTabs samples={signedClients} />
        <Alert
          showIcon
          type="info"
          title="必需请求头"
          description="X-Custody-Key、X-Custody-Timestamp（Unix 秒）、X-Custody-Nonce（每次唯一）、X-Custody-Signature。提现还必须发送 Idempotency-Key。密钥只展示一次，禁止放入网页、Git 或日志。"
        />
      </section>

      <section className="data-panel docs-section">
        <Title level={2}>开放 API 与逐接口 Demo</Title>
        <Paragraph>以下是当前全部租户开放 API。点击接口可查看可复制的调用代码、响应和字段说明。</Paragraph>
        <Collapse items={endpointItems} defaultActiveKey={['chains', 'create-address']} />
      </section>

      <section className="data-panel docs-section">
        <Title level={2}>Webhook 配置、验签与幂等</Title>
        <Paragraph>
          回调签名为 <Text code>v1=Base64URL(HMAC-SHA256(secret, timestamp + "." + rawBody))</Text>。
          必须使用未解析、未格式化的原始请求体验签。请求头同时包含 X-Custody-Event-Id、
          X-Custody-Event-Type、X-Custody-Timestamp 和 X-Custody-Signature。
        </Paragraph>
        <CodeTabs samples={webhookHandlers} />
        <Alert
          showIcon
          type="warning"
          title="回调处理要求"
          description="同一 event.id 可能因网络超时而重复送达。先持久化幂等记录，再返回 2xx；业务处理应异步执行。非 2xx 会指数退避重试，失败记录可在 Webhooks 页面筛选并单笔或批量重试。"
        />
        <Title level={3}>充值确认回调 Demo</Title>
        <CodeBlock>{depositWebhook}</CodeBlock>
        <Title level={3}>提现状态回调 Demo</Title>
        <CodeBlock>{withdrawalWebhook}</CodeBlock>
        <Paragraph>
          提现事件包括 WITHDRAWAL.CREATED、WITHDRAWAL.BROADCAST、WITHDRAWAL.BROADCAST_UNKNOWN、
          WITHDRAWAL.CONFIRMED 和 WITHDRAWAL.FAILED。以最终事件更新业务状态，不要仅依赖创建接口的初始状态。
        </Paragraph>
      </section>

      <section className="data-panel docs-section">
        <Title level={2}>核心字段字典</Title>
        <Table
          rowKey="field"
          columns={fieldColumns}
          dataSource={fieldRows}
          pagination={false}
          scroll={{ x: 720 }}
        />
      </section>

      <section className="data-panel docs-section">
        <Title level={2}>上线检查清单</Title>
        <ul className="developer-checklist">
          <li>只开通实际使用的链；API Key 默认可以调用全部租户 API，生产环境应启用 IP 白名单。</li>
          <li>服务端时间保持同步；nonce 永不复用；签名失败时记录 requestTarget 和 request-id，但不记录 secret。</li>
          <li>保存 subject、addressVersion 和返回地址；换址时递增版本；所有 EVM 链对同一 subject + 版本复用同一地址；Memo 链同时保存地址与 memo。</li>
          <li>提现使用唯一 Idempotency-Key，金额使用 Decimal/BigDecimal，并在业务侧保留人工风控。</li>
          <li>Webhook 原始体验签、event.id 幂等、快速返回 2xx；定期检查失败投递和对账差异。</li>
          <li>充值以 CONFIRMED 为入账依据；提现区分创建、广播、未知、确认和失败状态。</li>
        </ul>
      </section>
    </div>
  );
}
