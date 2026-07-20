import { Col, Form, Input, InputNumber, Row, Switch } from 'antd';
import { useI18n } from '../i18n';

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

export function WalletChainForm({ switches = true }: { switches?: boolean }) {
  const { t } = useI18n();
  const required = [{ required: true, message: t('Required') }];
  const switchLabels: Record<string, string> = {
    enabled: t('Enabled'), scanEnabled: t('Scanning'), withdrawEnabled: t('Withdrawals'),
    collectionEnabled: t('Collection'), transferEnabled: t('Transfers'),
  };
  return (
    <>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="chain" label={t('Chain')} rules={required}><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="network" label={t('Network')} rules={required}><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="family" label={t('Family')} rules={required}><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="nativeSymbol" label={t('Native symbol')} rules={required}><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="runtimeCurrencyId" label={t('Runtime currency ID')} rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="bip44CoinType" label={t('BIP44 coin type')} rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="chainId" label={t('Chain ID')}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="depositConfirmations" label={t('Deposit confirmations')} rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="withdrawConfirmations" label={t('Withdraw confirmations')} rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="defaultFeeRate" label={t('Default fee rate')}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="dustThreshold" label={t('Dust threshold')}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={8}><Form.Item name="scanBatchSize" label={t('Scan batch size')} rules={required}><InputNumber min={1} className="full-width" /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item name="explorerUrl" label={t('Explorer URL')}><Input /></Form.Item></Col>
        <Col span={12}><Form.Item name="gasPolicy" label={t('Gas policy')}><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Form.Item name="scanStartHeight" label={t('Scan start height')} rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
        <Col span={12}><Form.Item name="scanMaxBlocksPerRun" label={t('Max blocks per run')} rules={required}><InputNumber min={0} className="full-width" /></Form.Item></Col>
      </Row>
      {switches ? (
        <Row gutter={16}>
          {['enabled', 'scanEnabled', 'withdrawEnabled', 'collectionEnabled', 'transferEnabled'].map((key) => (
            <Col key={key}><Form.Item name={key} label={switchLabels[key]} valuePropName="checked"><Switch /></Form.Item></Col>
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
