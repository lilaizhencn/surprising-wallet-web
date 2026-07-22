import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';
import { formatAmount, formatDate, queryString } from '../utils/format';

const evmChainOptions = [
  'ETH', 'BNB', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE', 'AVAX_C',
  'HYPEREVM', 'MANTLE', 'LINEA', 'SCROLL', 'UNICHAIN',
].map((value) => ({ value }));

type Recovery = {
  id: string;
  tenantId: string;
  custodyAddressId?: string;
  actualChain: string;
  expectedChain?: string;
  assetSymbol: string;
  tokenContract?: string;
  tokenDecimals?: number;
  txHash: string;
  logIndex: number;
  destinationAddress: string;
  recoveryAddress?: string;
  claimedAmount?: string | number;
  verifiedAmount?: string | number;
  blockHeight?: number;
  blockHash?: string;
  confirmations: number;
  status: string;
  verificationDetails?: string;
  failureReason?: string;
  recoveryTxHash?: string;
  createdAt: string;
  updatedAt: string;
};

type SubmitValues = {
  actualChain: string;
  expectedChain?: string;
  assetSymbol: string;
  tokenContract?: string;
  txHash: string;
  logIndex?: number;
  destinationAddress: string;
  claimedAmount?: string;
};

const statusOptions = [
  '', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'EXECUTING', 'BROADCAST', 'RECOVERED', 'REJECTED', 'CANCELLED',
].map((value) => ({ value, label: value || 'All statuses' }));

export default function AssetRecoveriesPage({ platform = false }: { platform?: boolean }) {
  const { message } = App.useApp();
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selected, setSelected] = useState<Recovery>();
  const [approveCase, setApproveCase] = useState<Recovery>();
  const [rejectCase, setRejectCase] = useState<Recovery>();
  const [busy, setBusy] = useState(false);
  const [submitForm] = Form.useForm<SubmitValues>();
  const [approveForm] = Form.useForm<{ recoveryAddress: string }>();
  const [rejectForm] = Form.useForm<{ reason: string }>();
  const basePath = platform
    ? '/custody/platform/v1/asset-recoveries'
    : '/custody/console/v1/asset-recoveries';
  const query = useApiQuery<Recovery[]>(
    (signal) => api.get(`${basePath}${queryString({ status })}`, signal),
    [basePath, status],
  );

  const submit = async (values: SubmitValues) => {
    setBusy(true);
    try {
      const result = await api.post<Recovery>(basePath, values);
      setSubmitOpen(false);
      submitForm.resetFields();
      setSelected(result);
      await query.refetch();
      if (result.status === 'VERIFIED') {
        await message.success(t('The transfer was verified and is waiting for platform approval.'));
      } else {
        await message.warning(result.failureReason || t('The request was saved and can be verified again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const action = async (recovery: Recovery, name: string, body?: unknown) => {
    setBusy(true);
    try {
      const result = await api.post<Recovery>(`${basePath}/${recovery.id}/${name}`, body);
      setSelected(result);
      await query.refetch();
      await message.success(t('Recovery case updated'));
      return result;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t(platform ? 'Asset recovery review' : 'Asset recovery')}
        description={t(platform
          ? 'Verify ownership, approve a safe destination, and execute audited recovery transfers.'
          : 'Submit an on-chain transfer sent on the wrong EVM network or with an unsupported token.')}
        actions={(
          <Space>
            <Select
              value={status}
              options={statusOptions.map((option) => ({ ...option, label: t(option.label) }))}
              onChange={setStatus}
              style={{ width: 160 }}
            />
            <Button icon={<ReloadOutlined />} onClick={query.refetch}>{t('Refresh')}</Button>
            {!platform ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)}>
                {t('Submit recovery request')}
              </Button>
            ) : null}
          </Space>
        )}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      {!platform ? (
        <Alert
          showIcon
          icon={<SafetyCertificateOutlined />}
          type="info"
          title={t('A transfer is recoverable only when the destination address is controlled by your tenant.')}
          description={t('The platform verifies the canonical transaction and amount. Token recovery also requires enough native coin at the source address to pay gas.')}
        />
      ) : null}
      <section className="data-panel">
        <Table<Recovery>
          rowKey="id"
          loading={query.loading}
          dataSource={query.data ?? []}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description={t('No asset recovery cases')} /> }}
          onRow={(row) => ({ onClick: () => setSelected(row) })}
          columns={[
            { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            { title: t('Actual chain'), dataIndex: 'actualChain' },
            {
              title: t('Asset'),
              render: (_, row) => (
                <Space>{row.assetSymbol}{row.tokenContract ? <Tag>ERC-20</Tag> : <Tag>{t('Native asset')}</Tag>}</Space>
              ),
            },
            {
              title: t('Verified amount'),
              render: (_, row) => row.verifiedAmount === null || row.verifiedAmount === undefined
                ? '—' : `${formatAmount(row.verifiedAmount)} ${row.assetSymbol}`,
            },
            { title: t('Transaction'), dataIndex: 'txHash', ellipsis: true, width: 210 },
            { title: t('Updated'), dataIndex: 'updatedAt', render: formatDate },
            {
              title: t('Actions'),
              onCell: () => ({ onClick: (event) => event.stopPropagation() }),
              render: (_, row) => (
                <Space wrap>
                  {platform && row.status === 'SUBMITTED'
                    ? <Button size="small" onClick={() => action(row, 'verify')}>{t('Verify')}</Button>
                    : null}
                  {platform && row.status === 'VERIFIED'
                    ? <Button size="small" type="primary" onClick={() => setApproveCase(row)}>{t('Approve')}</Button>
                    : null}
                  {platform && row.status === 'APPROVED'
                    ? <Button size="small" type="primary" onClick={() => action(row, 'execute')}>{t('Execute recovery')}</Button>
                    : null}
                  {platform && row.status === 'BROADCAST'
                    ? <Button size="small" onClick={() => action(row, 'confirm')}>{t('Confirm on chain')}</Button>
                    : null}
                  {platform && ['SUBMITTED', 'VERIFIED'].includes(row.status)
                    ? <Button size="small" danger onClick={() => setRejectCase(row)}>{t('Reject')}</Button>
                    : null}
                  {!platform && ['SUBMITTED', 'VERIFIED'].includes(row.status)
                    ? <Button size="small" danger onClick={() => action(row, 'cancel')}>{t('Cancel')}</Button>
                    : null}
                </Space>
              ),
            },
          ]}
        />
      </section>

      <Drawer
        width={600}
        title={t('Recovery case details')}
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
      >
        {selected ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('Status')}><StatusText value={selected.status} /></Descriptions.Item>
            <Descriptions.Item label={t('Actual chain')}>{selected.actualChain}</Descriptions.Item>
            <Descriptions.Item label={t('Expected chain')}>{selected.expectedChain || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('Asset')}>{selected.assetSymbol}</Descriptions.Item>
            <Descriptions.Item label={t('Verified amount')}>
              {selected.verifiedAmount === undefined ? '—' : `${formatAmount(selected.verifiedAmount)} ${selected.assetSymbol}`}
            </Descriptions.Item>
            <Descriptions.Item label={t('Destination address')}><CopyText value={selected.destinationAddress} /></Descriptions.Item>
            <Descriptions.Item label={t('Transaction')}><CopyText value={selected.txHash} /></Descriptions.Item>
            <Descriptions.Item label={t('Log index')}>{selected.logIndex}</Descriptions.Item>
            <Descriptions.Item label={t('Block hash')}>{selected.blockHash ? <CopyText value={selected.blockHash} /> : '—'}</Descriptions.Item>
            <Descriptions.Item label={t('Confirmations')}>{selected.confirmations}</Descriptions.Item>
            <Descriptions.Item label={t('Recovery address')}>{selected.recoveryAddress ? <CopyText value={selected.recoveryAddress} /> : '—'}</Descriptions.Item>
            <Descriptions.Item label={t('Recovery transaction')}>{selected.recoveryTxHash ? <CopyText value={selected.recoveryTxHash} /> : '—'}</Descriptions.Item>
            <Descriptions.Item label={t('Failure reason')}>{selected.failureReason || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('Created')}>{formatDate(selected.createdAt)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal
        title={t('Submit asset recovery request')}
        open={submitOpen}
        confirmLoading={busy}
        onCancel={() => setSubmitOpen(false)}
        onOk={() => submitForm.submit()}
        destroyOnHidden
      >
        <Form form={submitForm} layout="vertical" onFinish={submit}>
          <Form.Item name="actualChain" label={t('Actual chain')} rules={[{ required: true }]}>
            <Select showSearch options={evmChainOptions} />
          </Form.Item>
          <Form.Item name="expectedChain" label={t('Expected chain')}>
            <Select allowClear showSearch options={evmChainOptions} />
          </Form.Item>
          <Form.Item name="assetSymbol" label={t('Asset symbol')} rules={[{ required: true }]}>
            <Input placeholder="USDT" />
          </Form.Item>
          <Form.Item name="tokenContract" label={t('Token contract')} extra={t('Leave empty for the native coin.')}>
            <Input />
          </Form.Item>
          <Form.Item name="txHash" label={t('Transaction hash')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="logIndex" label={t('Log index')} extra={t('Required only when one transaction contains multiple matching token transfers.')}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="destinationAddress" label={t('System destination address')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="claimedAmount" label={t('Claimed amount')}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('Approve recovery destination')}
        open={Boolean(approveCase)}
        confirmLoading={busy}
        onCancel={() => setApproveCase(undefined)}
        onOk={() => approveForm.submit()}
        destroyOnHidden
      >
        <Form
          form={approveForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!approveCase) return;
            await action(approveCase, 'approve', values);
            setApproveCase(undefined);
            approveForm.resetFields();
          }}
        >
          <Form.Item name="recoveryAddress" label={t('Recovery address')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('Reject recovery request')}
        open={Boolean(rejectCase)}
        confirmLoading={busy}
        okButtonProps={{ danger: true }}
        onCancel={() => setRejectCase(undefined)}
        onOk={() => rejectForm.submit()}
        destroyOnHidden
      >
        <Form
          form={rejectForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!rejectCase) return;
            await action(rejectCase, 'reject', values);
            setRejectCase(undefined);
            rejectForm.resetFields();
          }}
        >
          <Form.Item name="reason" label={t('Reason')} rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
