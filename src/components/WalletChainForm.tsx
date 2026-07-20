import { Col, Form, Input, InputNumber, Row, Switch } from 'antd';

export type WalletChainFormValues = {
  chain: string;
  network: string;
  family: string;
  runtimeCurrencyId: number;
  bip44CoinType: number;
  nativeSymbol: string;
  explorerUrl?: string;
  depositConfirmations: number;
  withdrawConfirmations: number;
  defaultFeeRate?: number;
  dustThreshold?: number;
  enabled: boolean;
  chainId?: number;
  gasPolicy?: string;
  scanBatchSize: number;
  scanEnabled: boolean;
  withdrawEnabled: boolean;
  collectionEnabled: boolean;
  transferEnabled: boolean;
  scanStartHeight: number;
  scanMaxBlocksPerRun: number;
};

const required = [{ required: true, message: 'Required' }];

export function WalletChainForm({ switches = true }: { switches?: boolean }) {
  return (
    <>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="chain" label="Chain" rules={required}><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="network" label="Network" rules={required}><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="family" label="Family" rules={required}><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="nativeSymbol" label="Native symbol" rules={required}><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="runtimeCurrencyId" label="Runtime currency ID" rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="bip44CoinType" label="BIP44 coin type" rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="chainId" label="Chain ID"><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="depositConfirmations" label="Deposit confirmations" rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="withdrawConfirmations" label="Withdraw confirmations" rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="defaultFeeRate" label="Default fee rate"><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="dustThreshold" label="Dust threshold"><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="scanBatchSize" label="Scan batch size" rules={required}><InputNumber min={1} className="full-width" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item name="explorerUrl" label="Explorer URL"><Input /></Form.Item></Col>
        <Col span={12}><Form.Item name="gasPolicy" label="Gas policy"><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item name="scanStartHeight" label="Scan start height" rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={12}><Form.Item name="scanMaxBlocksPerRun" label="Max blocks per run" rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
      </Row>
      {switches ? (
        <Row gutter={16}>
          {['enabled', 'scanEnabled', 'withdrawEnabled', 'collectionEnabled', 'transferEnabled'].map((key) => (
            <Col key={key}><Form.Item name={key} label={key} valuePropName="checked"><Switch /></Form.Item></Col>
          ))}
        </Row>
      ) : null}
    </>
  );
}

export const defaultChainValues: Partial<WalletChainFormValues> = {
  depositConfirmations: 1,
  withdrawConfirmations: 1,
  scanBatchSize: 100,
  scanStartHeight: 0,
  scanMaxBlocksPerRun: 0,
  enabled: false,
  scanEnabled: false,
  withdrawEnabled: false,
  collectionEnabled: false,
  transferEnabled: false,
};
