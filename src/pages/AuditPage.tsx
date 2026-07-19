import { Button, Empty, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatDate } from '../utils/format';

type AuditRow = {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  sourceIp?: string;
  details: string;
  createdAt: string;
};

export default function AuditPage() {
  const session = useSession();
  const query = useApiQuery<AuditRow[]>(
    (signal) => session
      ? api.get('/custody/console/v1/audit-log?limit=200', session.token, signal)
      : Promise.resolve([]),
    [session?.token],
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Audit log"
        description="Tenant security and operational changes recorded with actor and source context."
        actions={<Button icon={<ReloadOutlined />} onClick={query.refetch}>Reload</Button>}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <Table<AuditRow>
          rowKey="id"
          loading={query.loading}
          dataSource={query.data ?? []}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="No audit events yet" /> }}
          scroll={{ x: 1080 }}
          expandable={{
            expandedRowRender: (row) => (
              <pre className="audit-details">{formatJson(row.details)}</pre>
            ),
          }}
          columns={[
            { title: 'Action', dataIndex: 'action' },
            { title: 'Actor', dataIndex: 'actorType' },
            { title: 'Actor ID', dataIndex: 'actorId', render: (value) => <CopyText value={value} /> },
            { title: 'Resource', dataIndex: 'resourceType' },
            { title: 'Resource ID', dataIndex: 'resourceId', render: (value) => <CopyText value={value} /> },
            { title: 'Source IP', dataIndex: 'sourceIp', render: (value) => value || '—' },
            { title: 'Time', dataIndex: 'createdAt', render: formatDate },
          ]}
        />
      </section>
    </div>
  );
}

function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
