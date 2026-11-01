import { useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';

type MemberRole = 'OPERATOR' | 'APPROVER' | 'VIEWER';
type Member = {
  id: string;
  email: string;
  displayName: string;
  role: MemberRole | 'TENANT_ADMIN';
  status: 'ACTIVE' | 'DISABLED';
};
type MemberFields = { email: string; displayName: string; password: string; role: MemberRole; status: Member['status'] };

export default function TenantMembersPage() {
  const session = useSession();
  const { t } = useI18n();
  const { message } = App.useApp();
  const [form] = Form.useForm<MemberFields>();
  const [passwordForm] = Form.useForm<{ password: string }>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member>();
  const [passwordTarget, setPasswordTarget] = useState<Member>();
  const [saving, setSaving] = useState(false);
  const query = useApiQuery((signal) => api.get<Member[]>('/custody/console/v1/users', signal), [session?.userId]);
  const roles = [
    { value: 'OPERATOR', label: t('Operator') },
    { value: 'APPROVER', label: t('Approver') },
    { value: 'VIEWER', label: t('Viewer') },
  ];
  const label = (role: Member['role']) => role === 'TENANT_ADMIN' ? t('Tenant administrator') : roles.find((item) => item.value === role)?.label;
  const begin = (member?: Member) => {
    setEditing(member);
    form.resetFields();
    form.setFieldsValue(member ? { ...member, role: member.role as MemberRole } : { role: 'OPERATOR', status: 'ACTIVE' });
    setOpen(true);
  };
  const save = async (values: MemberFields) => {
    setSaving(true);
    try {
      if (editing) await api.put(`/custody/console/v1/users/${editing.id}`, { displayName: values.displayName, role: values.role, status: values.status });
      else await api.post('/custody/console/v1/users', { email: values.email, displayName: values.displayName, role: values.role, password: values.password });
      setOpen(false);
      form.resetFields();
      query.refetch();
      void message.success(t('Member saved'));
    } catch (error) { void message.error(error instanceof Error ? error.message : t('Unable to save member')); }
    finally { setSaving(false); }
  };
  const resetPassword = async ({ password }: { password: string }) => {
    if (!passwordTarget) return;
    setSaving(true);
    try {
      await api.post(`/custody/console/v1/users/${passwordTarget.id}/reset-password`, { password });
      setPasswordTarget(undefined);
      passwordForm.resetFields();
      query.refetch();
      void message.success(t('Member password reset'));
    } catch (error) { void message.error(error instanceof Error ? error.message : t('Unable to reset password')); }
    finally { setSaving(false); }
  };
  return <>
    <PageHeader title={t('Team members')} description={t('Manage tenant operators, approvers and read-only accounts.')} actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => begin()}>{t('Add member')}</Button>} />
    <Alert type="info" title={t('Copy the Wallet member ID for the independent administrator to invite this reviewer. Wallet roles and password resets do not activate or reset approval credentials.')} style={{ marginBottom: 16 }} />
    {query.error && <Alert type="error" title={query.error} action={<Button onClick={query.refetch}>{t('Retry')}</Button>} />}
    <Table<Member> rowKey="id" loading={query.loading} dataSource={query.data ?? []} pagination={{ pageSize: 20 }} scroll={{ x: 760 }} columns={[
      { title: t('Wallet member ID'), dataIndex: 'id', render: value => <Typography.Text copyable>{value}</Typography.Text> },
      { title: t('Email'), dataIndex: 'email' },
      { title: t('Display name'), dataIndex: 'displayName' },
      { title: t('Role'), dataIndex: 'role', render: label },
      { title: t('Status'), dataIndex: 'status', render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{t(status === 'ACTIVE' ? 'Active' : 'Disabled')}</Tag> },
      { title: t('Actions'), render: (_, member) => member.role === 'TENANT_ADMIN' ? null : <Space>
        <Button type="link" onClick={() => begin(member)}>{t('Edit')}</Button>
        <Button type="link" onClick={() => { passwordForm.resetFields(); setPasswordTarget(member); }}>{t('Reset password')}</Button>
      </Space> },
    ]} />
    <Modal title={t(editing ? 'Edit member' : 'Add member')} open={open} confirmLoading={saving} onOk={() => form.submit()} onCancel={() => { setOpen(false); form.resetFields(); }}>
      {editing && <Alert type="info" title={t('Saving changes signs this member out of existing sessions.')} />}
      <Form form={form} layout="vertical" onFinish={save} preserve={false}>
        {!editing && <Form.Item name="email" label={t('Email')} rules={[{ required: true, type: 'email', max: 254 }]}><Input autoComplete="off" /></Form.Item>}
        <Form.Item name="displayName" label={t('Display name')} rules={[{ required: true, whitespace: true, max: 120 }]}><Input /></Form.Item>
        <Form.Item name="role" label={t('Role')} rules={[{ required: true }]}><Select options={roles} /></Form.Item>
        {!editing && <Form.Item name="password" label={t('Initial password')} rules={[{ required: true, min: 12, max: 256 }]}><Input.Password autoComplete="new-password" /></Form.Item>}
        {editing && <Form.Item name="status" label={t('Status')} rules={[{ required: true }]}><Select options={[{ value: 'ACTIVE', label: t('Active') }, { value: 'DISABLED', label: t('Disabled') }]} /></Form.Item>}
      </Form>
    </Modal>
    <Modal title={t('Reset password')} open={Boolean(passwordTarget)} confirmLoading={saving} onOk={() => passwordForm.submit()} onCancel={() => { setPasswordTarget(undefined); passwordForm.resetFields(); }}>
      <p>{passwordTarget?.email}</p>
      <Alert type="warning" title={t('Resetting the password signs this member out of all sessions.')} />
      <Form form={passwordForm} layout="vertical" onFinish={resetPassword} preserve={false}>
        <Form.Item name="password" label={t('New password')} rules={[{ required: true, min: 12, max: 256 }]}><Input.Password autoComplete="new-password" /></Form.Item>
      </Form>
    </Modal>
  </>;
}
